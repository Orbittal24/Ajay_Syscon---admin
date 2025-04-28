import serial
import time
import RPi.GPIO as GPIO
import socket  # For TCP/IP communication
import threading

# Configure the serial connection
ser = serial.Serial(
    port='/dev/ttyUSB0',     # Change to the correct port for your device
    baudrate=1200,           # Set baud rate to 1200
    bytesize=serial.SEVENBITS,  # Data size set to 7 bits
    parity=serial.PARITY_NONE,  # Parity options: PARITY_NONE, PARITY_EVEN, PARITY_ODD, PARITY_MARK, PARITY_SPACE
    stopbits=serial.STOPBITS_ONE,  # Stop bits set to 1
    timeout=1                # Read timeout in seconds
)

if ser.is_open:
    print("Serial port is open!")

# Initialize an empty list to store all the data parts
data_parts = []

# Set up the GPIO pins
GPIO.setmode(GPIO.BCM)  # Use BCM pin numbering
GPIO.setwarnings(False)

# Define the pin numbers for the push buttons and LEDs
BUTTON_PINS = [18, 24, 6, 17, 27, 22]
LED_PIN_BLINK = 23  # Pin to blink when button is pressed
LED_PIN_REPLY = 5   # Pin to blink when reply is received

# Create a mapping between button pins and IDs
button_id_map = {
    18: "L1",
    24: "L2",
    6:  "L3",
    17: "L4",
    27: "L5",
    22: "L6"
}

# Set up the pins as input and enable pull-up resistors for buttons
for pin in BUTTON_PINS:
    GPIO.setup(pin, GPIO.IN, pull_up_down=GPIO.PUD_UP)

# Set up LED pins as output
GPIO.setup(LED_PIN_BLINK, GPIO.OUT)
GPIO.setup(LED_PIN_REPLY, GPIO.OUT)

# By default, set Button 1 as the active button when the Raspberry Pi starts
last_button_pressed = "L1"  # Default is L1 for the first time
initial_transmission_done = False  # Flag to track first transmission

# Function to check if the button is pressed with debounce
def is_button_pressed(pin):
    if GPIO.input(pin) == GPIO.LOW:
        time.sleep(0.05)
        if GPIO.input(pin) == GPIO.LOW:
            return True
    return False

# Function to blink an LED
def blink_led(pin, duration=0.5, times=3):
    for _ in range(times):
        GPIO.output(pin, GPIO.HIGH)
        time.sleep(duration)
        GPIO.output(pin, GPIO.LOW)
        time.sleep(duration)

# Function to send data to the server
# Function to send data to the server
def send_data_to_server(data_parts):
    try:
        SERVER_IP = '192.168.0.72'
        SERVER_PORT = 7080
        
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.connect((SERVER_IP, SERVER_PORT))
            print(f"Connected to {SERVER_IP}:{SERVER_PORT}")

            # Send data to the server in the correct format
            message = ' '.join(data_parts).encode('utf-8')
            sock.sendall(message)
            print(f"Sent data to server: {data_parts}")
             
            response = sock.recv(1024).decode('utf-8')
            print(f"Received from server: {response}")
            
            # If valid response, blink LED
            if "HTTP/1.1 400 Bad Request" not in response:
                blink_led(LED_PIN_REPLY, duration=0.2, times=5)
            else:
                print("Invalid response received (HTTP/1.1 400 Bad Request), ignoring.")
    except Exception as e:
        print(f"Error sending data to server: {e}")

try:
    print("Monitoring buttons and serial data... Press Ctrl+C to exit.")
    
    while True:
        # Check for button presses
        for pin in BUTTON_PINS:
            if is_button_pressed(pin):
                print(f"Button connected to GPIO {pin} pressed")

                # Update the last button pressed
                last_button_pressed = button_id_map[pin]
                print(f"Active button set to: {last_button_pressed}")

                # Blink LED when button is pressed
                blink_led(LED_PIN_BLINK, duration=0.1, times=3)

                # Send data immediately when a button is pressed
                if len(data_parts) > 0:
                    data_parts.append("lance_button")  # Changed from "buttonId" to "lance_button"
                    data_parts.append(last_button_pressed)
                    send_data_to_server(data_parts)
                    data_parts.clear()
                    print("Data cleared")

                # Wait for button release to avoid multiple detections
                while GPIO.input(pin) == GPIO.LOW:
                    time.sleep(0.1)

        # Check for serial data
        if ser.in_waiting > 0:
            if len(data_parts) >= 9:
                data_parts.clear()
                print(f"Cleared data: {data_parts}")

            data = ser.readline().decode('latin-1').rstrip()
            print(data)

            # Process the received serial data
            data_parts.extend(data.split())

            # Add a gateway ID and send the data
            if len(data_parts) == 7:
                data_parts.append("GATEWAY_06")
                print(f"Received: {data_parts}")

                # Send the first transmission with L1 (default button)
                if not initial_transmission_done:
                    data_parts.append("lance_button")  # Changed from "buttonId" to "lance_button"
                    data_parts.append(last_button_pressed)  # Initially L1
                    send_data_to_server(data_parts)
                    initial_transmission_done = True  # Mark initial transmission as done
                    data_parts.clear()
                    print("Initial data transmission done with default button L1")
                else:
                    # After the initial transmission, use the last button pressed
                    data_parts.append("lance_button")  # Changed from "buttonId" to "lance_button"
                    data_parts.append(last_button_pressed)
                    send_data_to_server(data_parts)
                    data_parts.clear()
                    print("Subsequent data sent with latest button pressed")

        time.sleep(0.1)

except KeyboardInterrupt:
    print("Program stopped by user.")

finally:
    GPIO.cleanup()
    ser.close()
    print("Serial port closed.")

