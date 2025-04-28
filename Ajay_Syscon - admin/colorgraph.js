const express = require('express');
const path = require('path');
const sql = require('mssql');
const http = require('http');
const socketIO = require('socket.io');
const moment = require('moment');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const sqlConfig = {
    user: "admin9",
    password: "admin9",
    database: "ajay_syscon",
    server: 'DESKTOP-5UJJEQ0',
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 1500000,
    },
    options: {
        encrypt: false,
        trustServerCertificate: true,
    },
};

const pool = new sql.ConnectionPool(sqlConfig);
const poolConnect = pool.connect();

poolConnect.then(() => {
    console.log('Connected to the database');
}).catch(err => {
    console.error('Error connecting to the database:', err);
});

app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'dist')));

app.get("/colorgrapgh", (req, res) => {
    res.sendFile(path.join(__dirname, "colorgrapgh.html"));
});
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
        console.log('Location mappings initialized');
    } catch (err) {
        console.error('Error fetching location mappings:', err);
    }
}

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

            console.log(`Fetching data. From: ${fromDate}, To: ${toDate}, Location: ${location}, Sub-location: ${sublocation}, Lance: ${lance}`);

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


const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
