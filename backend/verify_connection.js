const net = require('net');

async function testConnection() {
    const check = async (ip, port) => {
        return new Promise((resolve) => {
            const socket = new net.Socket();
            socket.setTimeout(2000);
            socket.connect(port, ip, () => {
                socket.destroy();
                resolve({ success: true, message: `Connected to ${ip}:${port}` });
            });
            socket.on('error', (err) => {
                socket.destroy();
                resolve({ success: false, message: err.message });
            });
            socket.on('timeout', () => {
                socket.destroy();
                resolve({ success: false, message: 'Timeout' });
            });
        });
    };

    console.log('Testing connection logic...');
    
    const results = [];
    results.push(await check('127.0.0.1', 5000)); // Should succeed
    results.push(await check('127.0.0.1', 9999)); // Should fail
    
    console.log('\nVerification Results:');
    results.forEach(r => console.log(`${r.success ? '✅' : '❌'} ${r.message}`));
}

testConnection();
