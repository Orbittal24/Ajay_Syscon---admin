import RPi.GPIO as GPIO
import time
import requests
import socketio
import threading

# GPIO pin numbers
BUTTON_PINS = [18, 24, 6, 16, 20, 21]  # Added buttons connected to GPIO 16, 20, and 21
LED_PIN_SEND = 23  # LED connected to GPIO 23 (indicates data sending)
LED_PIN_INSERT = 5  # LED connected to GPIO 5 (indicates successful data insertion)

# Unique IDs for each button
BUTTON_IDS = {
    18: "ID1",
    24: "ID2",
    6: "ID3",
    16: "ID4",  # New button
    20: "ID5",  # New button
    21: "ID6"   # New button
}

# Setup GPIO
GPIO.setmode(GPIO.BCM)
for pin in BUTTON_PINS:
    GPIO.setup(pin, GPIO.IN, pull_up_down=GPIO.PUD_UP)
    GPIO.setup(LED_PIN_SEND, GPIO.OUT)
    GPIO.setup(LED_PIN_INSERT, GPIO.OUT)

# Initialize variables to store data
received_date = ""
received_time = ""
run_cycle_no = ""
temperature = ""
last_data_received_time = None  # Track the time when data is received

# Timer to auto-send data if no button is pressed within 30 seconds
send_timer = None

# Set up Socket.IO client
sio = socketio.Client()

@sio.event
def connect():
    print('Connected to server')

@sio.event
def disconnect():
    print('Disconnected from server')
    try_reconnect()

@sio.on('data-inserted')
def on_data_inserted(data):
    print("Data inserted event received:", data)
    clear_data()  # Clear data on acknowledgment
    GPIO.output(LED_PIN_INSERT, GPIO.HIGH)
    time.sleep(3)
    GPIO.output(LED_PIN_INSERT, GPIO.LOW)

def clear_data():
    """Clears the stored data and stops the LED from blinking."""
    global received_date, received_time, run_cycle_no, temperature, last_data_received_time
    received_date = ""
    received_time = ""
    run_cycle_no = ""
    temperature = ""
    last_data_received_time = None
    print("Data cleared due to timeout or acknowledgment.")

def data_clear_checker():
    """Continuously checks if data should be cleared every 30 seconds."""
    global last_data_received_time
    while True:
        if last_data_received_time and (time.time() - last_data_received_time > 30):
            clear_data()
        time.sleep(1)  # Check every second

# New function to auto send data if no button is pressed within 30 seconds
def auto_send_data():
    data = get_data("ID0")  # Use "ID0" to indicate no button was pressed
    if data:
        print(f"No button pressed within 30 seconds. Sending data: {data}")
        send_data_to_server(data)
    else:
        print("No valid data to send automatically.")

# Simulating the reception of data
def receive_data_from_hercules():
    """
    Simulated function to mimic receiving static data for testing.
    """
    # Static data for testing
    static_data = "18-09-2024, 12:09:08, A2345, 0551"
    print(f"Simulated data received: {static_data}")
    return static_data

def parse_hercules_data(data_string):
    global received_date, received_time, run_cycle_no, temperature, last_data_received_time, send_timer
    try:
        date, time_, run_no, temp = data_string.split(", ")
        received_date = date
        received_time = time_
        run_cycle_no = run_no
        temperature = temp
        last_data_received_time = time.time()  # Update the last received time
        
        print(f"Data parsed: Date={received_date}, Time={received_time}, Run Cycle No={run_cycle_no}, Temperature={temperature}")
        
        # Cancel the previous timer if it exists
        if send_timer:
            send_timer.cancel()
        
        # Start a new 30-second timer to send the data if no button is pressed
        send_timer = threading.Timer(30.0, auto_send_data)
        send_timer.start()
    except ValueError as e:
        print(f"Error parsing data from Hercules: {e}")

# Modified get_data function to ensure the button_id is dynamic and format is correct
def get_data(button_id):
    # Static data for testing: date, time, run cycle number, temperature remain the same
    received_date = "18-09-2024"  # Correct format as dd-mm-yyyy
    received_time = "12:09:08"    # Time in hh:mm:ss format
    run_cycle_no = "A2345"        # Alphanumeric run cycle number
    temperature = "0551"          # Four-digit temperature

    # The button_id should be passed dynamically based on the pressed button
    data_string = f"date:{received_date},time:{received_time},run:{run_cycle_no},temp:{temperature},id:{button_id}"
    
    return data_string

def send_data_to_server(data):
    server_url = "http://192.168.72.14:7080"
    
    try:
        response = requests.post(server_url, data=data)
        if response.status_code == 200:
            print("Data sent successfully!")
        else:
            print("Failed to send data. Server responded with status code:", response.status_code)
    except Exception as e:
        print("An error occurred while sending data:", e)

def handle_button_press(button_pin):
    global send_timer
    button_id = BUTTON_IDS[button_pin]
    
    hercules_data_string = receive_data_from_hercules()
    if hercules_data_string:
        parse_hercules_data(hercules_data_string)
        data = get_data(button_id)
        if data:
            print(f"Button {button_id} pressed. Data to be sent: {data}")
            
            # Cancel the auto-send timer since the button was pressed
            if send_timer:
                send_timer.cancel()
            
            # Turn on LED, wait for 2 seconds, then turn off
            GPIO.output(LED_PIN_SEND, GPIO.HIGH)
            time.sleep(2)  # Keep the LED on for 2 seconds
            GPIO.output(LED_PIN_SEND, GPIO.LOW)
            
            send_data_to_server(data)
        else:
            print(f"No valid data to send for button {button_id}")
    else:
        print(f"No data received for button {button_id}")

def debounce_button(pin):
    initial_state = GPIO.input(pin)
    time.sleep(0.2)  # Increased debounce time to 200ms
    final_state = GPIO.input(pin)
    return initial_state == GPIO.LOW and final_state == GPIO.LOW

def monitor_buttons():
    while True:
        for pin in BUTTON_PINS:
            if debounce_button(pin):  # Only process the button if it is confirmed pressed after debouncing
                print(f"Button {BUTTON_IDS[pin]} pressed, sending data to server...")
                threading.Thread(target=handle_button_press, args=(pin,)).start()
        time.sleep(0.1)  # Small delay to avoid high CPU usage

def try_reconnect():
    while True:
        try:
            sio.connect('http://192.168.72.14:3000')
            monitor_buttons()  # Restart monitoring buttons after reconnect
            break
        except Exception as e:
            print("Reconnection failed, retrying in 5 seconds...")
            time.sleep(5)

# Start the data clearing checker in a separate thread
threading.Thread(target=data_clear_checker, daemon=True).start()

try:
    # Simulate receiving static data immediately
    hercules_data_string = receive_data_from_hercules()
    if hercules_data_string:
        parse_hercules_data(hercules_data_string)

    sio.connect('http://192.168.72.14:3000')  # Connect to the Socket.IO server
    monitor_buttons()
    
except KeyboardInterrupt:
    print("Program terminated by user.")
finally:
    GPIO.cleanup()
    sio.disconnect()
