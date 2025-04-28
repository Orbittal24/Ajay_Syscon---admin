var path = require("path");
var net = require('net');
var sql = require("mssql");
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const moment = require('moment'); // For date calculations
const cron = require('node-cron'); // Import node-cron
// const open = require('open');
// const open = require('open');
const open = async (url) => (await import('open')).default(url);
// require('dotenv').config();

const PORT_HTTP = 3000; // For frontend navigation

const EventEmitter = require('events');
EventEmitter.defaultMaxListeners = 50;

const app = express();
const server = http.createServer(app);
const io = socketIo(server);  // Initialize Socket.IO
// const path = require('path');

// app.use('/img', express.static(path.join(__dirname, 'dist', 'img')));

let tempNum //= parseInt(temp, 10); 
let minTempNum// = parseInt(min_temp, 10);
let maxTempNum //= parseInt(max_temp, 10);

let tempStatus = '';
let new_data_flag = 0;
const sqlConfig = {
    user: "admin9",
    password: "admin9",
    database: "ajay_syscon",
//   server: 'DESIGN',
    server: 'DESKTOP-5UJJEQ0',
    // server: 'DESIGN',


    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 1500000,
    },
    options: {
        encrypt: false,
        trustServerCertificate: false,
    },
};

// Create a database connection pool
const pool = new sql.ConnectionPool(sqlConfig);
const poolConnect = pool.connect();

poolConnect.then(() => {
    console.log('Connected to the database');
}).catch(err => {
    console.error('Error connecting to database:', err);
});
// /////////////////////////////lisence part strt//////////////////////////////////////////
const getLicenseInfo = async () => {
    await poolConnect; // Ensure the connection is ready

    const request = pool.request();
    const query = `
        SELECT MIN(actual_date_time) AS first_entry, 
               MAX(actual_date_time) AS last_entry 
        FROM furnace_readings_reports`;

    const result = await request.query(query);
    return result.recordset[0];
};
// /////////////////////////////lisence part end//////////////////////////////////////////

// //////////////////////filters sublocation grapgh success start//////////////

let locationMappings = []; // Store location mappings globally

// Fetch location mappings from the database once at the start
async function initializeLocationMappings() {
    try {
        await poolConnect; // Ensure the connection is open
        const query = `
            SELECT Location, sublocation, Switch AS lance, min_temp, max_temp
            FROM ajay_syscon.dbo.location_mapping_master
        `;
        const result = await pool.request().query(query);
        locationMappings = result.recordset;
        // console.log('Location mappings initialized');
    } catch (err) {
        console.error('Error fetching location mappings:', err);
    }
}
// //////////////////////filters sublocation grapgh success end//////////////


const PORT = 7080;
var sockets = [];

// const serverTcp = net.createServer((socket) => {
//     console.log('Client connected');
    
//     socket.on('data', async (data) => {
//         new_data_flag = 1;
//         try {
//             let dataStr = data.toString();
//             let valuesArray = dataStr.split(" ");
//             console.log(`Received from client: ${valuesArray}`);

//             // Extract values from the expected positions in the array
//             let date = valuesArray[3] || '';
//             let time = valuesArray[4] || '';
//             let run = valuesArray[2] || '';
//             let temp = valuesArray[6] || '0';
//             let lance_button = valuesArray[9] || 'NoButton';
//             let gatewayId = valuesArray[7] || 'Unknown';

//             console.log(`Received date: ${date}`);
//             console.log(`Received time: ${time}`);
//             console.log(`Received run: ${run}`);
//             console.log(`Received temp: ${temp}`);
//             console.log(`Received lance_button: ${lance_button}`);
//             console.log(`Received gatewayId: ${gatewayId}`);

//             // Validate and reformat date and time values
//             const dateRegex = /^\d{2}\/\d{2}$/; // Expected format: MM/DD
//             const timeRegex = /^\d{2}:\d{2}$/; // Expected format: HH:MM

//             if (!dateRegex.test(date)) {
//                 throw new Error(`Invalid date format: ${date}`);
//             }
//             if (!timeRegex.test(time)) {
//                 throw new Error(`Invalid time format: ${time}`);
//             }

//             // Reformat date into 'YYYY-MM-DD'
//             const [month, day] = date.split('/');
//             const currentYear = new Date().getFullYear();
//             const formattedDate = `${currentYear}-${month}-${day}`;

//             // Construct the full date-time string with seconds as ':00'
//             const actualDateTime = `${formattedDate} ${time}:00`;
//             console.log(`Constructed actualDateTime: ${actualDateTime}`);

//             // Connect to the SQL server and get the shifts
//             const result = await pool.request().query('SELECT * FROM ajay_syscon.dbo.shift_master');
//             const shifts = result.recordset;

//             // Query to get the min, max temperature, and the unit from location_mapping_master table
//             const tempResult = await pool.request().query(`SELECT TOP 1 min_temp, max_temp FROM ajay_syscon.dbo.location_mapping_master ORDER BY CreatedAt DESC`);
//             if (tempResult.recordset.length === 0) {
//                 throw new Error('No temperature range found in the database');
//             }

//             const { min_temp, max_temp } = tempResult.recordset[0];
//             console.log('Temperature Range:', { min_temp, max_temp });

//             const tempNum = parseInt(temp, 10);
//             const minTempNum = parseInt(min_temp, 10);
//             const maxTempNum = parseInt(max_temp, 10);

//             // Extract the unit from min_temp or max_temp
//             const unit = min_temp.replace(/[0-9]/g, '').trim() || '°C';
//             const temperatureWithUnit = `${tempNum}${unit}`;
            
//             let tempStatus = 'inRange';
//             if (tempNum < minTempNum) {
//                 tempStatus = 'belowRange';
//             } else if (tempNum > maxTempNum) {
//                 tempStatus = 'outOfRange';
//             }

//             console.log(`Temperature ${temperatureWithUnit} is ${tempStatus}. Min: ${minTempNum}, Max: ${maxTempNum}`);

//             //////// Location, Sublocation, and Lance_Button Code Start ////////////
//             const locationResult = await pool.request()
//                 .input('gatewayId', sql.VarChar, gatewayId)
//                 .input('lance_button', sql.VarChar, lance_button)
//                 .query(`SELECT TOP 1 Location, sublocation, Switch FROM ajay_syscon.dbo.location_mapping_master WHERE gateway_id = @gatewayId AND lance_button = @lance_button`);

//             if (locationResult.recordset.length === 0) {
//                 throw new Error('No matching location found for the gateway_id and lance_button');
//             }

//             const locationData = locationResult.recordset[0];
//             const { Location, sublocation, Switch } = locationData;
//             console.log('Retrieved Location Data:', locationData);

//             let currentShift = null;
//             const currentHour = new Date().getHours();
//             const currentMinutes = new Date().getMinutes();

//             // Determine the current shift based on the time
//             shifts.forEach(shift => {
//                 const startTime = shift.start_time instanceof Date ? shift.start_time.toTimeString().slice(0, 5) : shift.start_time;
//                 const endTime = shift.end_time instanceof Date ? shift.end_time.toTimeString().slice(0, 5) : shift.end_time;
            
//                 console.log(`Checking Shift: ${shift.shift_code} (${startTime} - ${endTime})`);
            
//                 const [startHour, startMinutes] = startTime.split(':').map(Number);
//                 const [endHour, endMinutes] = endTime.split(':').map(Number);
            
//                 console.log(`Start Time: ${startHour}:${startMinutes}, End Time: ${endHour}:${endMinutes}`);
            
//                 if (endHour < startHour) {
//                     console.log('Shift spans midnight');
//                     if (
//                         (currentHour > startHour || (currentHour === startHour && currentMinutes >= startMinutes)) ||
//                         (currentHour < endHour || (currentHour === endHour && currentMinutes <= endMinutes))
//                     ) {
//                         currentShift = shift;
//                         console.log(`Matched Shift: ${shift.shift_code}`);
//                     }
//                 } else {
//                     if (
//                         (currentHour > startHour || (currentHour === startHour && currentMinutes >= startMinutes)) &&
//                         (currentHour < endHour || (currentHour === endHour && currentMinutes <= endMinutes))
//                     ) {
//                         currentShift = shift;
//                         console.log(`Matched Shift: ${shift.shift_code}`);
//                     }
//                 }
//             });
            
        
            
//             if (!currentShift) {
//                 console.log('No matching shift found. Check shift timings and current time.');
//             }
            
//             if (currentShift) {
//                 // Insert data into the database, including min_temp and max_temp
//                 const insertQuery = `INSERT INTO ajay_syscon.dbo.furnace_readings_reports 
//                     (runcycle_no, temperature, shift, start_date, end_date, actual_date_time, button_id, gateway_id, location, sublocation, lance_button, min_temp, max_temp) 
//                     VALUES ('${run}', '${temperatureWithUnit}', '${currentShift.shift_code}', '${formattedDate}', '${formattedDate}', '${actualDateTime}', '${Switch}', '${gatewayId}', '${Location}', '${sublocation}', '${lance_button}', '${min_temp}', '${max_temp}')`;
            
//                 await pool.request().query(insertQuery);
//                 console.log('Data inserted into furnace_readings_reports successfully!!');
//                 socket.write('Data inserted successfully');
//             } else {
//                 console.log('No shift found for the received time');
//                 socket.write('Shift not found');
//             }
            
//         } catch (err) {
//             console.error('Error processing data:', err);
//             socket.write('Error inserting data');
//         }
//     });

//     socket.on('end', () => {
//         console.log('Client disconnected');
//     });

//     socket.on('error', (err) => {
//         console.error('Socket error:', err.message);
//     });
// });

const serverTcp = net.createServer((socket) => {
    console.log('Client connected');
    
    socket.on('data', async (data) => {
        new_data_flag = 1;
        try {
            let dataStr = data.toString();
            let valuesArray = dataStr.split(" ");
            console.log(`Received from client: ${valuesArray}`);

            // Extract values from the expected positions in the array
            let date = valuesArray[3] || '';
            let time = valuesArray[4] || '';
            let run = valuesArray[2] || '';
            let temp = valuesArray[6] || '0';
            let lance_button = valuesArray[9] || 'NoButton';
            let gatewayId = valuesArray[7] || 'Unknown';

            console.log(`Received date: ${date}`);
            console.log(`Received time: ${time}`);
            console.log(`Received run: ${run}`);
            console.log(`Received temp: ${temp}`);
            console.log(`Received lance_button: ${lance_button}`);
            console.log(`Received gatewayId: ${gatewayId}`);

            // Array of allowed gateway IDs
            const allowedGateways = [
                "GATEWAY_01", "GATEWAY_02", "GATEWAY_03", "GATEWAY_04",
                "GATEWAY_05", "GATEWAY_06", "GATEWAY_07", "GATEWAY_08", "GATEWAY_09"
            ];

            // Check if the received gateway ID is in the allowed gateways
            if (!allowedGateways.includes(gatewayId)) {
                console.error(`Invalid gateway ID: ${gatewayId}`);
                socket.write('Invalid gateway ID');
                return;
            }

            // Validate and reformat date and time values
            const dateRegex = /^\d{2}\/\d{2}$/; // Expected format: MM/DD
            const timeRegex = /^\d{2}:\d{2}$/; // Expected format: HH:MM

            if (!dateRegex.test(date)) {
                throw new Error(`Invalid date format: ${date}`);
            }
            if (!timeRegex.test(time)) {
                throw new Error(`Invalid time format: ${time}`);
            }

            // Reformat date into 'YYYY-MM-DD'
            const [month, day] = date.split('/');
            const currentYear = new Date().getFullYear();
            const formattedDate = `${currentYear}-${month}-${day}`;

            // Construct the full date-time string with seconds as ':00'
            const actualDateTime = `${formattedDate} ${time}:00`;
            console.log(`Constructed actualDateTime: ${actualDateTime}`);

            // Query to get the min, max temperature, and the unit from location_mapping_master table
            const tempResult = await pool.request().query(`SELECT TOP 1 min_temp, max_temp FROM ajay_syscon.dbo.location_mapping_master WHERE gateway_id = '${gatewayId}' ORDER BY CreatedAt DESC`);
            if (tempResult.recordset.length === 0) {
                throw new Error('No temperature range found for the gateway in the database');
            }

            const { min_temp, max_temp } = tempResult.recordset[0];
            console.log('Temperature Range:', { min_temp, max_temp });

            const tempNum = parseInt(temp, 10);
            const minTempNum = parseInt(min_temp, 10);
            const maxTempNum = parseInt(max_temp, 10);

            // Extract the unit from min_temp or max_temp
            const unit = min_temp.replace(/[0-9]/g, '').trim() || '°C';
            const temperatureWithUnit = `${tempNum}${unit}`;
            
            let tempStatus = 'inRange';
            if (tempNum < minTempNum) {
                tempStatus = 'belowRange';
            } else if (tempNum > maxTempNum) {
                tempStatus = 'outOfRange';
            }

            console.log(`Temperature ${temperatureWithUnit} is ${tempStatus}. Min: ${minTempNum}, Max: ${maxTempNum}`);

            //////// Location, Sublocation, and Lance_Button Code Start ////////////
            const locationResult = await pool.request()
                .input('gatewayId', sql.VarChar, gatewayId)
                .input('lance_button', sql.VarChar, lance_button)
                .query(`SELECT TOP 1 Location, sublocation, Switch FROM ajay_syscon.dbo.location_mapping_master WHERE gateway_id = @gatewayId AND lance_button = @lance_button`);

            if (locationResult.recordset.length === 0) {
                throw new Error('No matching location found for the gateway_id and lance_button');
            }

            const locationData = locationResult.recordset[0];
            const { Location, sublocation, Switch } = locationData;
            console.log('Retrieved Location Data:', locationData);

            let currentShift = null;
            const currentHour = new Date().getHours();
            const currentMinutes = new Date().getMinutes();

            // Determine the current shift based on the time
            const result = await pool.request().query('SELECT * FROM ajay_syscon.dbo.shift_master');
            const shifts = result.recordset;

            shifts.forEach(shift => {
                const startTime = shift.start_time instanceof Date ? shift.start_time.toTimeString().slice(0, 5) : shift.start_time;
                const endTime = shift.end_time instanceof Date ? shift.end_time.toTimeString().slice(0, 5) : shift.end_time;
                const [startHour, startMinutes] = startTime.split(':').map(Number);
                const [endHour, endMinutes] = endTime.split(':').map(Number);

                if (endHour < startHour) {
                    if (
                        (currentHour > startHour || (currentHour === startHour && currentMinutes >= startMinutes)) ||
                        (currentHour < endHour || (currentHour === endHour && currentMinutes <= endMinutes))
                    ) {
                        currentShift = shift;
                    }
                } else {
                    if (
                        (currentHour > startHour || (currentHour === startHour && currentMinutes >= startMinutes)) &&
                        (currentHour < endHour || (currentHour === endHour && currentMinutes <= endMinutes))
                    ) {
                        currentShift = shift;
                    }
                }
            });

            if (currentShift) {
                const insertQuery = `INSERT INTO ajay_syscon.dbo.furnace_readings_reports 
                    (runcycle_no, temperature, shift, start_date, end_date, actual_date_time, button_id, gateway_id, location, sublocation, lance_button, min_temp, max_temp) 
                    VALUES ('${run}', '${temperatureWithUnit}', '${currentShift.shift_code}', '${formattedDate}', '${formattedDate}', '${actualDateTime}', '${Switch}', '${gatewayId}', '${Location}', '${sublocation}', '${lance_button}', '${min_temp}', '${max_temp}')`;
            
                await pool.request().query(insertQuery);
                console.log('Data inserted into furnace_readings_reports successfully!!');
                socket.write('Data inserted successfully');
            } else {
                console.log('No shift found for the received time');
                socket.write('Shift not found');
            }

        } catch (err) {
            console.error('Error processing data:', err);
            socket.write('Error inserting data');
        }
    });

    socket.on('end', () => {
        console.log('Client disconnected');
    });

    socket.on('error', (err) => {
        console.error('Socket error:', err.message);
    });
});


serverTcp.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});

// Keep the server running and independent of client connections
serverTcp.on('error', (err) => {
    console.error('Server error:', err.message);
});


// server.listen(3000, () => {
//     console.log("Socket.IO server running on port 3000");
// });
if (!server.listening) {
    server.listen(PORT_HTTP, (err) => {
        if (err) {
            console.error(`Error starting HTTP server: ${err}`);
            return;
        }
        console.log(`HTTP Server running at http://localhost:${PORT_HTTP}/login`);
        open(`http://localhost:${PORT_HTTP}/login`, { app: { name: 'chrome' } })
            .then(() => console.log('Browser opened successfully'))
            .catch(err => console.error(`Failed to open browser: ${err}`));
    });
}


const httpServer = http.createServer();
const ioServer = socketIo(httpServer);



app.use(express.static(__dirname));
app.use(express.static('dist'));


app.get("/login", function (req, res) {
    res.sendFile(path.join(__dirname + "/login.html"));
});

app.get("/", function (req, res) {
    res.sendFile(path.join(__dirname + "/index.html"));
});

app.get("/advanced", function (req, res) {
    res.sendFile(path.join(__dirname + "/advanced.html"));
});

app.get("/report", function (req, res) {
    res.sendFile(path.join(__dirname + "/report.html"));
});


// app.get('/getPushButtons', async (req, res) => {
//     const gateway_id = req.query.gateway_id;
//     console.log("gateway_id", gateway_id);

//     try {
//         const pool = await sql.connect(sqlConfig);
//         const result = await pool
//             .request()
//             .input('gateway_id', sql.VarChar, gateway_id)  // Sanitized input
//             .query(`SELECT no_of_pushButtons FROM ajay_syscon.dbo.no_of_pushButtons WHERE gateway_id = @gateway_id`);
        
//         if (result.recordset.length > 0) {
//             res.json({ no_of_pushButtons: result.recordset[0].no_of_pushButtons });
//         } else {
//             res.status(404).json({ message: 'Gateway not found' });
//         }
//     } catch (err) {
//         console.error('Error querying the database:', err);
//         res.status(500).json({ error: 'Database error' });
//     }
// });

app.get("/adminInfo", function (req, res) {
    res.sendFile(path.join(__dirname + "/adminInfo.html"));
});

app.get("/adminview", function (req, res) {
    res.sendFile(path.join(__dirname + "/adminview.html"));
});

app.get("/advanced", function (req, res) {
    res.sendFile(path.join(__dirname + "/advanced.html"));
});

app.get("/assignport", function (req, res) {
    res.sendFile(path.join(__dirname + "/assignport.html"));
});

app.get("/assigntemp", function (req, res) {
    res.sendFile(path.join(__dirname + "/assigntemp.html"));
});

app.get("/companydashboard", function (req, res) {
    res.sendFile(path.join(__dirname + "/companydashboard.html"));
});

app.get("/live_temp", function (req, res) {
    res.sendFile(path.join(__dirname + "/live_temp.html"));
});

app.get("/login", function (req, res) {
    res.sendFile(path.join(__dirname + "/login.html"));
});

app.get("/main", function (req, res) {
    res.sendFile(path.join(__dirname + "/main.html"));
});

app.get("/report", function (req, res) {
    res.sendFile(path.join(__dirname + "/report.html"));
});

app.get("/setip", function (req, res) {
    res.sendFile(path.join(__dirname + "/setip.html"));
})

app.get("/shift", function (req, res) {
    res.sendFile(path.join(__dirname + "/shift.html"));
});

app.get("/view", function (req, res) {
    res.sendFile(path.join(__dirname + "/view.html"));
});


var curdate = new Date();
var yr = curdate.getFullYear();
var month = ("0" + (curdate.getMonth() + 1)).slice(-2);
var day = ("0" + curdate.getDate()).slice(-2);
var today_date_dd = yr + "-" + month + "-" + day + " " + curdate.getHours() + ":" + curdate.getMinutes() + ":" + curdate.getSeconds();
var today_date = yr + "-" + month + "-" + day;


io.sockets.on("connection", (socket) => {

    // Listen for login events from the client
    socket.on('login', async (data) => {
        const { username, password } = data;
    
        try {
            const request = pool.request();
            // Query the database to find the user
            const result = await request.input('username', sql.VarChar, username).query('SELECT * FROM users WHERE username = @username');
    
            if (result.recordset.length === 0) {
                // No user found with the provided username
                socket.emit('loginResult', { success: false, message: 'Invalid username or password' });
            } else {
                const user = result.recordset[0];
                // Directly compare the provided password with the stored password
                if (password === user.password) {
                    // Login successful
                    socket.emit('loginResult', { success: true, message: 'Login successful', user: user.username });
                } else {
                    // Password did not match
                    socket.emit('loginResult', { success: false, message: 'Invalid username or password' });
                }
            }
        } catch (error) {
            console.error('Error during login:', error);
            socket.emit('loginResult', { success: false, message: 'Server error, please try again later' });
        }
    });
    
    socket.on('registerUser', async (data) => {
        const { username, password } = data;
        try {
            const request = pool.request();
    
            // Insert the new user into the database using the password column
            await request.input('username', sql.VarChar, username).input('password', sql.VarChar, password).query('INSERT INTO users (username, password) VALUES (@username, @password)');
    
            socket.emit('registrationResult', { success: true, message: 'User registered successfully' });
        } catch (error) {
            console.error('Error during user registration:', error);
            socket.emit('registrationResult', { success: false, message: 'Error registering user, please try again later' });
        }
    });

///////////////////////////////////////////LIVE TEMPERATURE/////////////////////////////////////////    




const allowedGateways = [
    "GATEWAY_01", "GATEWAY_02", "GATEWAY_03", "GATEWAY_04",
    "GATEWAY_05", "GATEWAY_06", "GATEWAY_07", "GATEWAY_08", "GATEWAY_09"
  ];
  let lastSrNo = null; // Store the last `sr_no` sent to the frontend

  setInterval(async () => {
    try {
        const pool = await sql.connect(sqlConfig);

        // Fetch the latest inserted record including button_id
        const result = await pool.request().query(`
            SELECT TOP 1 
                sr_no, 
                temperature AS temp, 
                location, 
                sublocation, 
                actual_date_time, 
                min_temp, 
                max_temp, 
                gateway_id, 
                button_id -- Include button_id
            FROM [ajay_syscon].[dbo].[furnace_readings_reports]
            ${lastSrNo ? `WHERE sr_no > ${lastSrNo}` : ''} -- Fetch only new records
            ORDER BY sr_no DESC
        `);

        if (result.recordset.length > 0) {
            const latestRecord = result.recordset[0];

            let tempStatus = "inRange";
            const tempNum = parseInt(latestRecord.temp, 10);
            const minTempNum = parseInt(latestRecord.min_temp, 10);
            const maxTempNum = parseInt(latestRecord.max_temp, 10);

            if (tempNum < minTempNum) {
                tempStatus = "belowRange";
            } else if (tempNum > maxTempNum) {
                tempStatus = "outOfRange";
            }

            // Emit the latest record to the frontend
            socket.emit("tempCheckResult", {
                ...latestRecord,
                tempStatus,
            });

            // Update the last sent `sr_no`
            lastSrNo = latestRecord.sr_no;
        }
    } catch (err) {
        console.error("Database query failed:", err);
    }
}, 1000); // Check for new data every second

///////////////////////////////////////////LIVE TEMPERATURE/////////////////////////////////////////    
    
      
    socket.on('getRuncycle_list', function () {
        var Data_Arr = [];

        // var SelectQue = `SELECT DISTINCT sr_no, runcycle_no FROM ajay_syscon.dbo.furnace_readings_reports ORDER BY sr_no ASC`;
        var SelectQue = `SELECT DISTINCT runcycle_no FROM ajay_syscon.dbo.furnace_readings_reports`;
        console.log("SelectQue::::", SelectQue);

        sql.connect(sqlConfig, function (err) {
            var requestsel = new sql.Request();
            requestsel.query(SelectQue, function (err, cyclerecordset) {
                if (err) { }
                var result = cyclerecordset.recordset;
                for (i in result) {

                    var runcycle_no = result[i].runcycle_no;

                    Data_Arr.push(runcycle_no);
                }
                socket.emit("send_Runcycle_list", Data_Arr);
                console.log("send_Runcycle_list::::::", Data_Arr);
            });
        });
    });
    // get Runcycle no for dropdown end //

// ///////////////////////////////////////////////shift start ////////////////////////////////////////////////////

//     // get Shift for dropdown Strt //
//     socket.on('getShift', function () {

//         var Shift_Arr = [];
//         var SelectQue = `SELECT DISTINCT shift_code FROM ajay_syscon.dbo.shift_master;`;
      

//         console.log("SelectQue::::", SelectQue);
//         sql.connect(sqlConfig, function (err) {
//             var requestsel = new sql.Request();
//             requestsel.query(SelectQue, function (err, shiftrecordset) {
//                 if (err) { }
//                 var result = shiftrecordset.recordset;
//                 for (i in result) {

//                     var shift_code = result[i].shift_code;

//                     Shift_Arr.push(shift_code);
//                 }
//                 socket.emit("sendShift", Shift_Arr);
//                 console.log("sendShift::::::", Shift_Arr);

//             });
//         });
//     });


//     socket.on('assignShift', function (data) {
//         const { shiftCode, startTime, endTime } = data;
//         const insertQuery = `
//             INSERT INTO ajay_syscon.dbo.shift_master (shift_code, start_time, end_time) 
//             VALUES ('${shiftCode}', '${startTime}', '${endTime}');
//         `;
    
//         sql.connect(sqlConfig, function (err) {
//             if (err) {
//                 console.error("SQL Connection Error: ", err);
//                 socket.emit('assignStatus', { success: false, message: 'Database connection error.' });
//                 return;
//             }
    
//             const request = new sql.Request();
//             request.query(insertQuery, function (err) {
//                 if (err) {
//                     console.error("Insert Error: ", err);
//                     socket.emit('assignStatus', { success: false, message: 'Failed to assign shift.' });
//                 } else {
//                     socket.emit('assignStatus', { success: true, message: 'Shift assigned successfully!' });
//                 }
//             });
//         });
//     });
    
// // Fetch shift start and end times based on shift code
// socket.on('getShiftTimes', function (data) {
//     const { shiftCode } = data;
//     const fetchShiftQuery = `SELECT start_time, end_time FROM ajay_syscon.dbo.shift_master WHERE shift_code = '${shiftCode}';`;

//     sql.connect(sqlConfig, function (err) {
//         if (err) {
//             console.error("SQL Connection Error: ", err);
//             socket.emit('sendShiftTimes', { startTime: '', endTime: '', error: 'Database connection error.' });
//             return;
//         }

//         const request = new sql.Request();
//         request.query(fetchShiftQuery, function (err, result) {
//             if (err || !result.recordset.length) {
//                 console.error("Fetch Shift Times Error: ", err);
//                 socket.emit('sendShiftTimes', { startTime: '', endTime: '', error: 'Shift times not found.' });
//             } else {
//                 const shiftTimes = result.recordset[0];
//                 socket.emit('sendShiftTimes', { startTime: shiftTimes.start_time, endTime: shiftTimes.end_time });
//             }
//         });
//     });
// });


// Get Shift for dropdown
// Get Shift for dropdown
socket.on('getShift', function () {
    const Shift_Arr = [];
    const SelectQue = `SELECT DISTINCT shift_code FROM ajay_syscon.dbo.shift_master;`;

    sql.connect(sqlConfig, function (err) {
        if (err) {
            console.error("SQL Connection Error:", err);
            return;
        }
        const request = new sql.Request();
        request.query(SelectQue, function (err, shiftRecordset) {
            if (err) {
                console.error("Query Error:", err);
                return;
            }
            const result = shiftRecordset.recordset;
            for (let i in result) {
                const shift_code = result[i].shift_code;
                Shift_Arr.push(shift_code);
            }
            console.log("Emitting shift codes to frontend:", Shift_Arr);
            socket.emit("sendShift", Shift_Arr);
        });
    });
});

const moment = require('moment');

// Fetch shift start and end times based on shift code
socket.on('getShiftTimes', function (data) {
    const { shiftCode } = data;
    const fetchShiftQuery = `SELECT start_time, end_time FROM ajay_syscon.dbo.shift_master WHERE shift_code = '${shiftCode}';`;

    sql.connect(sqlConfig, function (err) {
        if (err) {
            console.error("SQL Connection Error:", err);
            socket.emit('sendShiftTimes', { startTime: '', endTime: '', error: 'Database connection error.' });
            return;
        }

        const request = new sql.Request();
        request.query(fetchShiftQuery, function (err, result) {
            if (err) {
                console.error("Fetch Shift Times Error:", err);
                socket.emit('sendShiftTimes', { startTime: '', endTime: '', error: 'Error fetching shift times.' });
            } else if (result.recordset.length > 0) {
                const shiftTimes = result.recordset[0];

                // Format the times to "HH:mm"
                const formattedStartTime = moment(shiftTimes.start_time).format('HH:mm');
                const formattedEndTime = moment(shiftTimes.end_time).format('HH:mm');

                console.log("Formatted shift times:", { formattedStartTime, formattedEndTime });
                socket.emit('sendShiftTimes', { startTime: formattedStartTime, endTime: formattedEndTime });
            } else {
                console.log("No times found for shift code:", shiftCode);
                socket.emit('sendShiftTimes', { startTime: '', endTime: '' });
            }
        });
    });
});


// Insert or update shift based on existence
socket.on('assignOrUpdateShift', function (data) {
    const { shiftCode, startTime, endTime } = data;
    const checkShiftQuery = `SELECT shift_code FROM ajay_syscon.dbo.shift_master WHERE shift_code = '${shiftCode}';`;
    
    sql.connect(sqlConfig, function (err) {
        if (err) {
            console.error("SQL Connection Error:", err);
            socket.emit('assignStatus', { success: false, message: 'Database connection error.' });
            return;
        }

        const request = new sql.Request();
        request.query(checkShiftQuery, function (err, result) {
            if (err) {
                console.error("Check Shift Error:", err);
                socket.emit('assignStatus', { success: false, message: 'Error checking shift.' });
            } else if (result.recordset.length > 0) {
                // Shift exists, update it
                const updateQuery = `
                    UPDATE ajay_syscon.dbo.shift_master 
                    SET start_time = '${startTime}', end_time = '${endTime}' 
                    WHERE shift_code = '${shiftCode}';
                `;
                request.query(updateQuery, function (err) {
                    if (err) {
                        console.error("Update Error:", err);
                        socket.emit('assignStatus', { success: false, message: 'Failed to update shift.' });
                    } else {
                        socket.emit('assignStatus', { success: true, message: 'Shift updated successfully!' });
                    }
                });
            } else {
                // Shift does not exist, insert new
                const insertQuery = `
                    INSERT INTO ajay_syscon.dbo.shift_master (shift_code, start_time, end_time) 
                    VALUES ('${shiftCode}', '${startTime}', '${endTime}');
                `;
                request.query(insertQuery, function (err) {
                    if (err) {
                        console.error("Insert Error:", err);
                        socket.emit('assignStatus', { success: false, message: 'Failed to assign shift.' });
                    } else {
                        socket.emit('assignStatus', { success: true, message: 'Shift assigned successfully!' });
                    }
                });
            }
        });
    });
});



// ///////////////////////////////////////////////shift end ////////////////////////////////////////////////////



    // get bydefault table data start table data 
    socket.on("bydefault_data", function (today_date) {
        var curdate = new Date();
        var yr = curdate.getFullYear();
        var month = ("0" + (curdate.getMonth() + 1)).slice(-2);
        var day = ("0" + curdate.getDate()).slice(-2);
        var today_date = `${yr}-${month}-${day}`;
    
        var DefaultQuery1 = `
            SELECT DISTINCT runcycle_no, temperature, location, shift, 
                            start_date, gateway_id, button_id, sublocation, actual_date_time
            FROM ajay_syscon.dbo.furnace_readings_reports
            WHERE CONVERT(DATE, actual_date_time) = '${today_date}'
        `;
    
        console.log("DefaultQuery1::", DefaultQuery1);
    
        sql.connect(sqlConfig, function (err) {
            if (err) {
                console.log(err);
                return;
            }
            var request = new sql.Request();
            request.query(DefaultQuery1, function (err, recordset) {
                if (err) {
                    console.log(err);
                    return;
                }
                let table_array = [];
                recordset.recordset.forEach(function (row) {
                    table_array.push({
                        runcycle_no: row.runcycle_no,
                        temperature: row.temperature,
                        location: row.location,
                        shift: row.shift,
                        start_date: row.start_date,
                        gateway_id: row.gateway_id,
                        button_id: row.button_id,
                        sublocation: row.sublocation,
                        actual_date_time: row.actual_date_time,
                    });
                });
                socket.emit("default_get_table_details", table_array);
                console.log("default_get_table_details::::::", table_array);
            });
        });
    });
    
    // get bydefault meter details table data end //


    // get filter table data strt in report //
    // socket.on("get_filter_details", function (runcycle, ToDate, FromDate, shift) {
    //     console.log("get_filter_details", runcycle, ToDate, FromDate, shift);
    
    //     let conditions = [];
    
    //     // Add Run No condition if it is selected
    //     if (runcycle && runcycle !== 'Select Run No') {
    //         conditions.push(`runcycle_no = '${runcycle}'`);
    //     }
    
    //     // Add Shift condition if it is selected
    //     if (shift && shift !== 'Select Shift') {
    //         conditions.push(`shift = '${shift}'`);
    //     }
    
    //     // Add Date range filtering
    //     if (FromDate && ToDate) {
    //         conditions.push(`CONVERT(DATE, actual_date_time) BETWEEN '${FromDate}' AND '${ToDate}'`);
    //     } else if (FromDate) {
    //         conditions.push(`CONVERT(DATE, actual_date_time) >= '${FromDate}'`);
    //     } else if (ToDate) {
    //         conditions.push(`CONVERT(DATE, actual_date_time) <= '${ToDate}'`);
    //     }
    
    //     // Build the WHERE clause only if conditions exist
    //     const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    //     const filtertableData = `
    //         SELECT runcycle_no, temperature, location, shift,
    //                start_date, gateway_id, button_id, sublocation, actual_date_time
    //         FROM ajay_syscon.dbo.furnace_readings_reports
    //         ${whereClause}
    //         ORDER BY start_date ASC, actual_date_time ASC;
    //     `;
    
    //     console.log("filtertableData::", filtertableData);
    
    //     // Execute the query
    //     sql.connect(sqlConfig, function (err) {
    //         if (err) {
    //             console.log(err);
    //             return;
    //         }
    //         var request = new sql.Request();
    //         request.query(filtertableData, function (err, recordset) {
    //             if (err) {
    //                 console.log(err);
    //                 return;
    //             }
    
    //             let table_array = [];
    //             recordset.recordset.forEach(function (row) {
    //                 table_array.push({
    //                     runcycle_no: row.runcycle_no,
    //                     temperature: row.temperature,
    //                     location: row.location,
    //                     shift: row.shift,
    //                     start_date: row.start_date,
    //                     gateway_id: row.gateway_id,
    //                     button_id: row.button_id,
    //                     sublocation: row.sublocation,
    //                     actual_date_time: row.actual_date_time,
    //                 });
    //             });
    
    //             socket.emit("get_filter_table_details", table_array);
    //             console.log("get_filter_table_details::::::", table_array);
    //         });
    //     });
    // });
    socket.on("get_filter_details", function (filters) {
        const { runcycle, ToDate, FromDate, shift, location, sublocation, lance } = filters;
        console.log("Received filter values:", filters);
    
        let conditions = [];
    
        // Add conditions for each filter if a value is selected
        if (runcycle && runcycle !== 'Select Run No') {
            conditions.push(`runcycle_no = '${runcycle}'`);
        }
        if (shift && shift !== 'Select Shift') {
            conditions.push(`shift = '${shift}'`);
        }
        if (location) {
            conditions.push(`location = '${location}'`);
        }
        if (sublocation) {
            conditions.push(`sublocation = '${sublocation}'`);
        }
        if (lance) {
            conditions.push(`button_id = '${lance}'`);
        }
        if (FromDate && ToDate) {
            conditions.push(`CONVERT(DATE, actual_date_time) BETWEEN '${FromDate}' AND '${ToDate}'`);
        } else if (FromDate) {
            conditions.push(`CONVERT(DATE, actual_date_time) >= '${FromDate}'`);
        } else if (ToDate) {
            conditions.push(`CONVERT(DATE, actual_date_time) <= '${ToDate}'`);
        }
    
        // Build the WHERE clause only if conditions exist
        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
        const filtertableData = `
            SELECT runcycle_no, temperature, location, shift,
                   start_date, gateway_id, button_id, sublocation, actual_date_time
            FROM ajay_syscon.dbo.furnace_readings_reports
            ${whereClause}
            ORDER BY start_date ASC, actual_date_time ASC;
        `;
    
        console.log("Generated SQL Query:", filtertableData);
    
        // Connect to the database and execute the query
        sql.connect(sqlConfig, function (err) {
            if (err) {
                console.error("Database connection error:", err);
                return;
            }
            const request = new sql.Request();
            request.query(filtertableData, function (err, recordset) {
                if (err) {
                    console.error("Query execution error:", err);
                    return;
                }
    
                const table_array = recordset.recordset.map(row => ({
                    runcycle_no: row.runcycle_no,
                    temperature: row.temperature,
                    location: row.location,
                    shift: row.shift,
                    start_date: row.start_date,
                    gateway_id: row.gateway_id,
                    button_id: row.button_id,
                    sublocation: row.sublocation,
                    actual_date_time: row.actual_date_time,
                }));
    
                console.log("Filtered Results:", table_array);
    
                // Emit the results back to the client
                socket.emit("get_filter_table_details", table_array);
            });
        });
    });
    
    socket.on('fetchDropdownOptions', () => {
        const dropdownQueries = {
            locations: `SELECT DISTINCT location FROM ajay_syscon.dbo.furnace_readings_reports`,
            sublocations: `SELECT DISTINCT sublocation FROM ajay_syscon.dbo.furnace_readings_reports`,
            lances: `SELECT DISTINCT button_id FROM ajay_syscon.dbo.furnace_readings_reports`
        };
    
        const results = {};
    
        sql.connect(sqlConfig, function (err) {
            if (err) {
                console.error("Database connection error:", err);
                return;
            }
    
            const request = new sql.Request();
    
            // Execute each query and gather results
            request.query(dropdownQueries.locations, function (err, locationResult) {
                if (err) {
                    console.error("Query execution error (locations):", err);
                    return;
                }
                results.locations = locationResult.recordset.map(row => row.location);
    
                // Fetch Sub-locations after Locations
                request.query(dropdownQueries.sublocations, function (err, sublocationResult) {
                    if (err) {
                        console.error("Query execution error (sublocations):", err);
                        return;
                    }
                    results.sublocations = sublocationResult.recordset.map(row => row.sublocation);
    
                    // Fetch Lances after Sub-locations
                    request.query(dropdownQueries.lances, function (err, lanceResult) {
                        if (err) {
                            console.error("Query execution error (lances):", err);
                            return;
                        }
                        results.lances = lanceResult.recordset.map(row => row.button_id);
    
                        // Emit the results back to the frontend
                        socket.emit("dropdownOptions", results);
                        console.log("Dropdown options sent:", results);
                    });
                });
            });
        });
    });
    
    // get filter table data end in report //
    
    
    //************* master shift start *****************// 
    socket.on('submitValues', function (shiftcode, startTime, endtime) {

        var curdate = new Date();
        var yr = curdate.getFullYear();
        var month = ("0" + (curdate.getMonth() + 1)).slice(-2);
        var day = ("0" + curdate.getDate()).slice(-2);
        var today_date_dd = yr + "-" + month + "-" + day + " " + curdate.getHours() + ":" + curdate.getMinutes() + ":" + curdate.getSeconds();
        var today_date = yr + "-" + month + "-" + day;

        var InsertData = `INSERT INTO ajay_syscon.dbo.shift_master (shift_code, start_time, end_time) VALUES ('${shiftcode}', '${startTime}', '${endtime}')`;
        console.log("InsertData::::", InsertData);

        sql.connect(sqlConfig, function (err) {
            if (err) {
                console.log(err);
                return;
            }
            var request = new sql.Request();
            request.query(InsertData, function (err, recordset) {
                if (err) {
                    console.log(err);
                    return;
                }
                // socket.emit("get_meter_details", table_array);
                console.log("Inserted Successfully!");
                // }
            });
        });
    });
    //************* master shift end *****************// 


//****************************************** Priyanka code start ********************************************//
    // socket.on('submitForm', async (formData) => {
    //     try {
    //         const request = pool.request();
    //         const insertFormQuery = `INSERT INTO ajay_syscon.dbo.ajay_syscon_info (company, address, city, state, country, pin, website, phone1, phone2, fax, datetime) VALUES ('${formData.company}', '${formData.address} ${formData.address2} ${formData.address3}', '${formData.city}', '${formData.state}', '${formData.country}', '${formData.pin}', '${formData.website}', '${formData.phone1}', '${formData.phone2}', '${formData.fax}', GETDATE())`;
    //         console.log('Executing form submission query:', insertFormQuery);
    //         await request.query(insertFormQuery);

    //         socket.emit('formSubmissionResult', 'Data saved successfully!');
    //     } catch (error) {
    //         console.error('Error inserting form data:', error);
    //         socket.emit('formSubmissionResult', 'Failed to save data.');
    //     }
    // });
  // Handle form submission and fetch the latest data
socket.on('submitForm', async (formData) => {
    try {
        const request = pool.request();

        const query = `
            IF EXISTS (SELECT 1 FROM ajay_syscon.dbo.ajay_syscon_info WHERE company = '${formData.company}')
            BEGIN
                UPDATE ajay_syscon.dbo.ajay_syscon_info
                SET address = '${formData.address}',
                    city = '${formData.city}',
                    state = '${formData.state}',
                    country = '${formData.country}',
                    pin = '${formData.pin}',
                    website = '${formData.website}',
                    phone1 = '${formData.phone1}',
                    phone2 = '${formData.phone2}',
                    fax = '${formData.fax}',
                    datetime = GETDATE()
                WHERE company = '${formData.company}';
            END
            ELSE
            BEGIN
                INSERT INTO ajay_syscon.dbo.ajay_syscon_info 
                (company, address, city, state, country, pin, website, phone1, phone2, fax, datetime)
                VALUES 
                ('${formData.company}', '${formData.address}', '${formData.city}', 
                '${formData.state}', '${formData.country}', '${formData.pin}', 
                '${formData.website}', '${formData.phone1}', '${formData.phone2}', 
                '${formData.fax}', GETDATE());
            END
        `;

        console.log('Executing query:', query);
        await request.query(query);

        const result = await request.query('SELECT TOP 1 * FROM ajay_syscon.dbo.ajay_syscon_info ORDER BY datetime DESC');
        socket.emit('receiveFormData', result.recordset[0]);

        socket.emit('formSubmissionResult', { status: 'success' });
    } catch (error) {
        console.error('Error inserting/updating form data:', error);
        socket.emit('formSubmissionResult', { status: 'error' });
    }
});

// Fetch the latest data on request
socket.on('requestFormData', async () => {
    try {
        const request = pool.request();
        const result = await request.query('SELECT TOP 1 * FROM ajay_syscon.dbo.ajay_syscon_info ORDER BY datetime DESC');

        socket.emit('receiveFormData', result.recordset[0]);
    } catch (error) {
        console.error('Error fetching form data:', error);
    }
});

  ////////////////////////////////////////////companyinfo start///////////////////////////////////  // 
  socket.on('submitFormCompany', async (formData) => {
    try {
        const request = pool.request();

        const query = `
            IF EXISTS (SELECT 1 FROM ajay_syscon.dbo.company_info WHERE company = '${formData.company}')
            BEGIN
                UPDATE ajay_syscon.dbo.company_info
                SET address = '${formData.address}',
                    city = '${formData.city}',
                    state = '${formData.state}',
                    country = '${formData.country}',
                    pin = '${formData.pin}',
                    website = '${formData.website}',
                    phone1 = '${formData.phone1}',
                    phone2 = '${formData.phone2}',
                    fax = '${formData.fax}',
                    datetime = GETDATE()
                WHERE company = '${formData.company}';
            END
            ELSE
            BEGIN
                INSERT INTO ajay_syscon.dbo.company_info 
                (company, address, city, state, country, pin, website, phone1, phone2, fax, datetime)
                VALUES 
                ('${formData.company}', '${formData.address}', '${formData.city}', 
                '${formData.state}', '${formData.country}', '${formData.pin}', 
                '${formData.website}', '${formData.phone1}', '${formData.phone2}', 
                '${formData.fax}', GETDATE());
            END
        `;

        console.log('Executing query:', query);
        await request.query(query);

        const result = await request.query('SELECT TOP 1 * FROM ajay_syscon.dbo.company_info ORDER BY datetime DESC');
        socket.emit('receiveFormDataCompany', result.recordset[0]);

        socket.emit('formSubmissionResultCompany', { status: 'success' });
    } catch (error) {
        console.error('Error inserting/updating form data:', error);
        socket.emit('formSubmissionResultCompany', { status: 'error' });
    }
});

// Fetch the latest data on request
socket.on('requestFormDataCompany', async () => {
    try {
        const request = pool.request();
        const result = await request.query('SELECT TOP 1 * FROM ajay_syscon.dbo.company_info ORDER BY datetime DESC');

        socket.emit('receiveFormDataCompany', result.recordset[0]);
    } catch (error) {
        console.error('Error fetching form data:', error);
    }
});

  ////////////////////////////////////////////companyinfo end///////////////////////////////////  // 

// ////////////////////////////////////////////admininfo end ///////////////////////////////////////////////////

    socket.on('requestAdminData', async () => {
        try {
            const request = pool.request();
            const fetchAdminDataQuery = 'SELECT TOP 1 * FROM ajay_syscon.dbo.ajay_syscon_info ORDER BY datetime DESC';
            console.log('Executing query to fetch admin data:', fetchAdminDataQuery);
            const result = await request.query(fetchAdminDataQuery);
            if (result.recordset.length > 0) {
                const formData = result.recordset[0];
                socket.emit('adminData', formData);
            } else {
                socket.emit('adminData', {});
            }
        } catch (error) {
            console.error('Error fetching admin data:', error);
            socket.emit('adminData', {});
        }
    });

    socket.on('assignGateway', async (data) => {
        const { portSelected, gatewayselect,  deviceID } = data;
        console.log("assignGateway::", data);
        
        try {
            const request = pool.request();
            // const insertQuery = `INSERT INTO ajay_syscon.dbo.register570withgateway (gateway_id, 570_id) VALUES ('${deviceID}', '${portSelected}')`;
            const insertQuery = `INSERT INTO ajay_syscon.dbo.register570withgateway (sublocation, gateway_id, [570_id]) VALUES ('${portSelected}',  '${gatewayselect}', '${deviceID}')`;
            console.log('Executing query:', insertQuery);

            await request.query(insertQuery);

            socket.emit('registrationStatus', 'Device registered successfully!');
        } 
        catch (error) {
            console.error('Error inserting data:', error);
            socket.emit('registrationStatus', 'Failed to register device.');
        }
    });

    // socket.on('assignSwitch', async (data) => {
    //     const { sublocation, switch: switchName, furnaceLocation, gatewayId, min_temp, max_temp } = data;
    //     console.log("assignSwitch ::", data);
        
    //     try {
    //         const request = pool.request();
    //         const insertQuery = `INSERT INTO ajay_syscon.dbo.location_mapping_master (sublocation, Switch, Location, gateway_id, min_temp , max_temp) VALUES ('${sublocation}', '${switchName}', '${furnaceLocation}', '${gatewayId}', '${min_temp}', '${max_temp}')`;
    //         console.log('Executing query:', insertQuery);
    //         await request.query(insertQuery);

    //         socket.emit('assignStatus', 'Data inserted successfully!');
    //     } catch (error) {
    //         console.error('Error inserting data:', error);
    //         socket.emit('assignStatus', 'Failed to insert data.');
    //     }
    // });

    socket.on('assignSwitch', async (data) => {
        const { sublocation, switch: switchName, furnaceLocation, gatewayId, min_temp, max_temp, lance_button } = data; // Add lance_button to destructuring
        console.log("assignSwitch ::", data);
        
        try {
            const request = pool.request();
            const insertQuery = `INSERT INTO ajay_syscon.dbo.location_mapping_master (sublocation, Switch, Location, gateway_id, min_temp, max_temp, lance_button) VALUES ('${sublocation}', '${switchName}', '${furnaceLocation}', '${gatewayId}', '${min_temp}', '${max_temp}', '${lance_button}')`;
            console.log('Executing query:', insertQuery);
            await request.query(insertQuery);
    
            socket.emit('assignStatus', 'Data inserted successfully!');
        } catch (error) {
            console.error('Error inserting data:', error);
            socket.emit('assignStatus', 'Failed to insert data.');
        }
    });
    
    socket.on('assignShift', function(data) {
        const { shiftCode, startTime, endTime } = data;
        
        const insertQuery = `INSERT INTO ajay_syscon.dbo.shift_master (shift_code, start_time, end_time) VALUES ('${shiftCode}', '${startTime}', '${endTime}');`;
        
        sql.connect(sqlConfig, function(err) {
            if (err) {
                console.error("SQL Connection Error: ", err);
                socket.emit('assignStatus', 'Database connection error.');
                return;
            }
            
            const request = new sql.Request();
            request.query(insertQuery, function(err) {
                if (err) {
                    console.error("Insert Error: ", err);
                    socket.emit('assignStatus', 'Failed to assign shift.');
                } else {
                    socket.emit('assignStatus', 'Shift assigned successfully.');
                }
            });
        });
    });

    socket.on('minmaxdropdown', function () {
        const minQuery = `SELECT DISTINCT min_temp, max_temp FROM ajay_syscon.dbo.location_mapping_master`;
        console.log("minQuery::::", minQuery);
    
        sql.connect(sqlConfig, function (err) {
            if (err) {
                console.error("SQL Connection Error:", err);
                return;
            }
    
            const request = new sql.Request();
            request.query(minQuery, function (err, result) {
                if (err) {
                    console.error("Query Error:", err);
                    return;
                }
    
                const ranges = result.recordset; // [{ min_temp: 20, max_temp: 30 }, ...]
                socket.emit("send_minmaxdropdown", ranges); // Send structured data
                console.log("send_minmaxdropdown::::::", ranges);
            });
        });
    });
    

//******************************************* Priyanka code end ***********************************************//

// ////////////////////new graph ///////////////////////////////////////////////////////////////////////

// io.on('connection', (socket) => {
//     console.log('A user connected');

//     async function fetchTemperatureData(fromDate = null, toDate = null) {
//         try {
//             if (!fromDate && !toDate) {
//                 const today = moment().format('YYYY-MM-DD');
//                 fromDate = today;
//                 toDate = today;
//             }

//             console.log(`Fetching data. From: ${fromDate}, To: ${toDate}`);

//             // const locationMappingResult = await pool.request().query(`
//             //     SELECT LOWER(Location) AS Location, 
//             //            LOWER(sublocation) AS sublocation, 
//             //            Switch AS lance, 
//             //            min_temp, max_temp
//             //     FROM ajay_syscon.dbo.location_mapping_master
//             // `);

                 
//         const locationMappingResult = await pool.request().query(`
//             SELECT Location,  -- Original case from DB
//                    sublocation,  -- Original case from DB
//                    Switch AS lance, 
//                    min_temp, max_temp
//             FROM ajay_syscon.dbo.location_mapping_master
//         `);
//             const locationMappings = locationMappingResult.recordset;

//             // const temperatureQuery = `
//             //     SELECT actual_date_time, temperature, 
//             //            LOWER(location) AS location, 
//             //            LOWER(sublocation) AS sublocation, 
//             //            button_id AS lance
//             //     FROM ajay_syscon.dbo.furnace_readings_reports
//             //     WHERE actual_date_time BETWEEN '${fromDate}' 
//             //       AND DATEADD(day, 1, '${toDate}')
//             //     ORDER BY actual_date_time DESC
//             // `;
//             const temperatureQuery = `
//             SELECT actual_date_time, temperature, 
//                    location,  -- Original case from DB
//                    sublocation,  -- Original case from DB
//                    button_id AS lance
//             FROM ajay_syscon.dbo.furnace_readings_reports
//             WHERE actual_date_time BETWEEN '${fromDate}' 
//               AND DATEADD(day, 1, '${toDate}')
//             ORDER BY actual_date_time DESC
//         `;
   
        
//             const temperatureResult = await pool.request().query(temperatureQuery);

//             const processedData = temperatureResult.recordset.map((item) => {
//                 const { temperature, location, sublocation, lance } = item;
            
//                 const matchingMapping = locationMappings.find(
//                     (mapping) =>
//                         mapping.Location === location &&
//                         (mapping.sublocation === sublocation || mapping.sublocation == null) &&
//                         mapping.lance === lance
//                 );
            
//                 if (!matchingMapping) {
//                     console.warn(`No matching location mapping for: ${location}, ${sublocation}, ${lance}`);
//                     return { ...item, tempStatus: 'noMapping' };
//                 }
            
//                 const minTemp = parseInt(matchingMapping.min_temp, 10);
//                 const maxTemp = parseInt(matchingMapping.max_temp, 10);
//                 const tempNum = parseInt(temperature, 10);
            
//                 let tempStatus = 'inRange';
//                 if (tempNum < minTemp) tempStatus = 'belowRange';
//                 if (tempNum > maxTemp) tempStatus = 'outOfRange';
            
//                 return { ...item, tempStatus };
//             });
            

//             socket.emit('temperatureData', processedData);
//         } catch (err) {
//             console.error('Error fetching temperature data:', err);
//         }
//     }

//     socket.on('filterData', ({ fromDate, toDate }) => {
//         console.log(`Filter request received -> From: ${fromDate}, To: ${toDate}`);
//         fetchTemperatureData(fromDate, toDate);
//     });

//     fetchTemperatureData();

//     socket.on('disconnect', () => {
//         console.log('User disconnected');
//     });
// });



// Initialize location mappings on server start
initializeLocationMappings();

io.on('connection', (socket) => {
    console.log('A user connected');

    async function fetchTemperatureData(fromDate = null, toDate = null, location = null, sublocation = null, lance = null) {
        try {
            await poolConnect; // Ensure the connection pool is established

            if (!fromDate && !toDate) {
                const today = moment().format('YYYY-MM-DD');
                fromDate = today;
                toDate = today;
            }

            // console.log(`Fetching data. From: ${fromDate}, To: ${toDate}, Location: ${location}, Sub-location: ${sublocation}, Lance: ${lance}`);

            let whereClause = `
                WHERE actual_date_time BETWEEN '${fromDate}' 
                AND DATEADD(day, 1, '${toDate}')
            `;
            if (location) whereClause += ` AND location = '${location}'`;
            if (sublocation) whereClause += ` AND sublocation = '${sublocation}'`;
            if (lance) whereClause += ` AND button_id = '${lance}'`;

            const temperatureQuery = `
                SELECT actual_date_time, temperature, 
                       location, sublocation, button_id AS lance
                FROM ajay_syscon.dbo.furnace_readings_reports
                ${whereClause}
                ORDER BY actual_date_time DESC
            `;

            const temperatureResult = await pool.request().query(temperatureQuery);

            const processedData = temperatureResult.recordset.map((item) => {
                const { temperature, location, sublocation, lance } = item;

                const matchingMapping = locationMappings.find(
                    (mapping) =>
                        mapping.Location === location &&
                        (mapping.sublocation === sublocation || mapping.sublocation == null) &&
                        mapping.lance === lance
                );

                if (!matchingMapping) {
                    console.warn(`No matching location mapping for: ${location}, ${sublocation}, ${lance}`);
                    return { ...item, tempStatus: 'noMapping' };
                }

                const minTemp = parseInt(matchingMapping.min_temp, 10);
                const maxTemp = parseInt(matchingMapping.max_temp, 10);
                const tempNum = parseInt(temperature, 10);

                let tempStatus = 'inRange';
                if (tempNum < minTemp) tempStatus = 'belowRange';
                if (tempNum > maxTemp) tempStatus = 'outOfRange';

                return { ...item, tempStatus };
            });

            socket.emit('temperatureData', processedData);
        } catch (err) {
            console.error('Error fetching temperature data:', err);
        }
    }

    socket.on('filterData', ({ fromDate, toDate, location, sublocation, lance }) => {
        console.log(`Filter request received -> From: ${fromDate}, To: ${toDate}, Location: ${location}, Sub-location: ${sublocation}, Lance: ${lance}`);
        fetchTemperatureData(fromDate, toDate, location, sublocation, lance);
    });

    // Fetch initial temperature data on client connection
    fetchTemperatureData();

    socket.on('fetchDropdownOptions', async () => {
        try {
            await poolConnect;  // Ensure the connection is open
            const locationOptionsQuery = `
                SELECT DISTINCT Location FROM ajay_syscon.dbo.location_mapping_master
            `;
            const result = await pool.request().query(locationOptionsQuery);
            const locations = result.recordset.map(record => record.Location);

            socket.emit('dropdownOptions', { locations });
        } catch (error) {
            console.error('Error fetching dropdown options:', error);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

// ////////////////////new graph end///////////////////////////////////////////////////////////////////////

// ///////////////////////////////////lisence start////////////////////////////////////////////////
    // Generate a license key based on the selected type
    let latestDateInDb = null; // Declare this at the top

    io.on('connection', (socket) => {
        console.log('Client connected');
    
        // Generate a license key based on the selected type
        socket.on('generateKey', (licenseType) => {
            const key = `${licenseType}-${Math.random().toString(36).substring(2, 10)}`;
            console.log(`Generated License Key: ${key}`); // Log the generated key
            socket.emit('keyGenerated', key);
        });
    
        socket.on('activateKey', async (key) => {
            let transaction;
            try {
                console.log(`Received Key: ${key}`);
        
                const validDays = getValidDays(key);
                if (validDays === null) {
                    console.error('Invalid license key type');
                    socket.emit('licenseData', { error: 'Invalid license key type' });
                    return;
                }
        
                // Fetch the latest date from the database
                const result = await pool.request().query(`
                    SELECT TOP 1 actual_date_time 
                    FROM [ajay_syscon].[dbo].[furnace_readings_reports]
                    ORDER BY actual_date_time DESC
                `);
        
                if (result.recordset.length === 0) {
                    throw new Error('No entries found in furnace_readings_reports table');
                }
        
                const latestDatabaseDate = moment(result.recordset[0].actual_date_time).format('YYYY-MM-DD');
                console.log(`Fetched Latest Date from Table: ${latestDatabaseDate}`);
        
                const activationDate = moment().format('YYYY-MM-DD');
                console.log(`Activation Date (First Entry Date): ${activationDate}`);
        
                transaction = new sql.Transaction(pool);
                await transaction.begin(); // Start transaction
        
                // Check if the license already exists
                const existingLicense = await transaction.request().query(`
                    SELECT * FROM [ajay_syscon].[dbo].[License_Info] 
                    WHERE License_Name = '${key}'
                `);
        
                let firstEntryDate, expiryDate, status;
        
                if (existingLicense.recordset.length > 0) {
                    // License already exists, update it
                    const license = existingLicense.recordset[0];
                    firstEntryDate = moment(license.First_Entry_Date).format('YYYY-MM-DD');
                    expiryDate = moment(license.Expiry_Date).format('YYYY-MM-DD');
                    status = moment(latestDatabaseDate).isAfter(expiryDate) ? 'deactive' : 'active';
        
                    await transaction.request().query(`
                        UPDATE [ajay_syscon].[dbo].[License_Info] 
                        SET 
                            Current_Entry_Date = '${latestDatabaseDate}',
                            Status_License = '${status}',
                            Days_Used = DATEDIFF(day, First_Entry_Date, '${latestDatabaseDate}'),
                            Days_Remaining = Valid_Days - DATEDIFF(day, First_Entry_Date, '${latestDatabaseDate}')
                        WHERE License_Name = '${key}'
                    `);
                    console.log(`License ${key} updated successfully.`);
                } else {
                    // License does not exist, insert a new one
                    firstEntryDate = activationDate;
                    expiryDate = moment(activationDate).add(validDays, 'days').format('YYYY-MM-DD');
                    status = 'active';
        
                    await transaction.request().query(`
                        IF NOT EXISTS (
                            SELECT 1 FROM [ajay_syscon].[dbo].[License_Info] WHERE License_Name = '${key}'
                        )
                        BEGIN
                            INSERT INTO [ajay_syscon].[dbo].[License_Info] 
                            (License_Name, First_Entry_Date, Current_Entry_Date, Status_License, 
                             Valid_Days, Days_Used, Days_Remaining, Expiry_Date)
                            VALUES 
                            ('${key}', '${firstEntryDate}', '${latestDatabaseDate}', '${status}', 
                             ${validDays}, 0, ${validDays}, '${expiryDate}')
                        END
                    `);
                    console.log(`License ${key} inserted successfully.`);
                }
        
                await transaction.commit(); // Commit transaction
        
                const daysUsed = moment(latestDatabaseDate).diff(moment(firstEntryDate), 'days');
                const daysRemaining = Math.max(validDays - daysUsed, 0);
        
                socket.emit('licenseData', {
                    First_Entry_Date: firstEntryDate,
                    Current_Entry_Date: latestDatabaseDate,
                    Status_License: status,
                    License_Name: key,
                    Valid_Days: validDays,
                    Days_Used: daysUsed,
                    Days_Remaining: daysRemaining,
                    Expiry_Date: expiryDate
                });
        
            } catch (error) {
                console.error('Error during license activation:', error);
                socket.emit('licenseData', { error: 'An error occurred during license activation' });
        
                if (transaction) {
                    await transaction.rollback(); // Rollback in case of error
                }
            }
        });
        
    });
    
    // Periodically check for latest date in the database
    setInterval(async () => {
        try {
            const result = await pool.request().query(`
                SELECT TOP 1 actual_date_time 
                FROM [ajay_syscon].[dbo].[furnace_readings_reports]
                ORDER BY actual_date_time DESC
            `);
    
            if (result.recordset.length > 0) {
                const newDate = moment(result.recordset[0].actual_date_time).format('YYYY-MM-DD');
    
                if (newDate !== latestDateInDb) {
                    latestDateInDb = newDate; // Update the stored date
                    console.log(`New Latest Date: ${newDate}`);
                    io.emit('dateUpdated', { latestDate: newDate }); // Emit to all connected clients
                }
            }
        } catch (error) {
            console.error('Error during periodic date check:', error);
        }
    }, 2 * 60 * 1000); // 2 minutes interval
    
    // Helper function to get valid days based on the license type
    function getValidDays(key) {
        if (key.startsWith('30-days')) return 30;
        if (key.startsWith('1-year')) return 365;
        if (key.startsWith('2-years')) return 730;
        return null;
    }
    
    socket.on('requestLatestDate', async () => {
    try {
        const result = await pool.request().query(`
            SELECT TOP 1 actual_date_time 
            FROM [ajay_syscon].[dbo].[furnace_readings_reports]
            ORDER BY actual_date_time DESC
        `);

        if (result.recordset.length > 0) {
            const latestDate = moment(result.recordset[0].actual_date_time).format('YYYY-MM-DD');
            socket.emit('dateUpdated', { latestDate }); // Emit the new date to the client
        }
    } catch (error) {
        console.error('Error fetching latest date:', error);
    }
});

// ///////////////////////////////////lisence end////////////////////////////////////////////////
// //////////////////////usermangement start////////////////////////////////////
  // Fetch all users
  socket.on("fetchUsers", async () => {
    try {
      const result = await pool
        .request()
        .query(`SELECT user_id, username, password FROM [ajay_syscon].[dbo].[users]`);
      socket.emit("usersData", result.recordset);
    } catch (error) {
      console.error("Error fetching users:", error);
      socket.emit("usersData", { error: "Failed to fetch users" });
    }
  });

  // Update a user
  socket.on("updateUser", async (data) => {
    const { user_id, username, password } = data;
    try {
      await pool
        .request()
        .input("username", sql.VarChar, username)
        .input("password", sql.VarChar, password)
        .input("user_id", sql.Int, user_id)
        .query(`
          UPDATE [ajay_syscon].[dbo].[users]
          SET username = @username, password = @password
          WHERE user_id = @user_id
        `);
      socket.emit("updateResult", { success: true });
    } catch (error) {
      console.error("Error updating user:", error);
      socket.emit("updateResult", { success: false, message: error.message });
    }
  });
// Delete a user
socket.on("deleteUser", async (data) => {
    const { user_id } = data;
    try {
        await pool
            .request()
            .input("user_id", sql.Int, user_id)
            .query(`DELETE FROM [ajay_syscon].[dbo].[users] WHERE user_id = @user_id`);
        socket.emit("deleteResult", { success: true });
    } catch (error) {
        console.error("Error deleting user:", error);
        socket.emit("deleteResult", { success: false, message: error.message });
    }
});


  // Handle client disconnect
  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
// //////////////////////usermangement end ////////////////////////////////////



});




