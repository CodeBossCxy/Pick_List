const socket = new WebSocket("wss://10.1.3.54:8002/ws");
const messages = document.getElementById("messages");

// Function to get barcode image URL for a location
function getBarcodeUrl(location) {
    return `https://barcode.orcascan.com/?type=Code128&data=${location}`;
}

// Function to create a row element
function createRowElement(data) {
    const row = document.createElement("tr");
    row.classList.add("adding-row");
    
    row.innerHTML = `
        <td>${data.serial_no}</td>
        <td>${data.part_no}</td>
        <td>${data.revision}</td>
        <td>${data.quantity}</td>
        <td>${data.location}</td>
        <td><img src="${getBarcodeUrl(data.location)}" alt="Barcode for ${data.location}" style="height: 50px;"></td>
        <td>${data.deliver_to}</td>
        <td><button class="delete-btn">Done</button></td>`;
    
    row.querySelector(".delete-btn").addEventListener("click", async () => {
        try {
            const response = await fetch(`/api/requests/${data.serial_no}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                const tbody = document.getElementById("containerTableBody");
                tbody.removeChild(row);
            } else {
                console.error('Failed to delete request');
            }
        } catch (error) {
            console.error('Error deleting request:', error);
        }
    });

    return row;
}

// Function to fetch and display requests
async function fetchAndDisplayRequests() {
    try {
        const response = await fetch('/api/requests');
        const requests = await response.json();
        
        const tbody = document.getElementById("containerTableBody");
        tbody.innerHTML = ''; // Clear existing rows
        
        requests.forEach(data => {
            const row = createRowElement(data);
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Error fetching requests:', error);
    }
}

// Fetch requests when page loads
document.addEventListener('DOMContentLoaded', fetchAndDisplayRequests);

// Set up polling to refresh data every 5 seconds
setInterval(fetchAndDisplayRequests, 5000);

socket.onmessage = function(event) {
    const t = document.getElementById("messages");
    const msg = document.createElement("li");
    msg.textContent = event.data;
    const data = JSON.parse(event.data);
    console.log("Received data in driver:", data);
    
    // Handle delete signal
    if (data.type === "delete") {
        console.log("Processing delete signal for serial:", data.serial_no);
        const tbody = document.getElementById("containerTableBody");
        const rows = tbody.getElementsByTagName("tr");
        let found = false;
        
        for (let row of rows) {
            const cells = row.getElementsByTagName("td");
            console.log("Checking row with serial:", cells[0].textContent);
            if (cells[0].textContent === data.serial_no) {
                console.log("Found matching row, removing it");
                tbody.removeChild(row);
                // Remove from localStorage
                const storedRows = JSON.parse(localStorage.getItem('driverRows') || '{}');
                delete storedRows[data.serial_no];
                localStorage.setItem('driverRows', JSON.stringify(storedRows));
                found = true;
                break;
            }
        }
        
        if (!found) {
            console.log("No matching row found for serial:", data.serial_no);
        }
        return;
    }

    // Handle normal container data
    console.log("Processing normal container data");
    const tbody = document.getElementById("containerTableBody");
    const row = createRowElement(data);
    tbody.appendChild(row);

    // Store in localStorage
    const storedRows = JSON.parse(localStorage.getItem('driverRows') || '{}');
    storedRows[data.serial_no] = data;
    localStorage.setItem('driverRows', JSON.stringify(storedRows));
    
    console.log("Added new row to table");
};

