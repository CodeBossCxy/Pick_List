// WebSocket connection for real-time notifications
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const socket = new WebSocket(`${protocol}//${window.location.host}/ws`);
const messages = document.getElementById("messages");

// Function to get barcode image URL for a location
function getBarcodeUrl(location) {
    return `https://barcode.orcascan.com/?type=code128&data=${location}`;
}

// Function to create a row element
function createRowElement(data) {
    const row = document.createElement("tr");
    row.classList.add("adding-row");

    // Check if this is a master unit (serial_no starts with "MU-")
    const isMasterUnit = data.serial_no && data.serial_no.startsWith('MU-');
    const displaySerial = isMasterUnit ?
        `<strong style="color: #0066cc;">📦 Master Unit: ${data.master_unit_no || data.serial_no.substring(3)}</strong>` :
        data.serial_no;

    // Determine request type display (default to PICK_UP for backward compatibility)
    const requestType = data.request_type || 'PICK_UP';
    const isPickUp = requestType === 'PICK_UP';
    const typeIcon = isPickUp ?
        '<i class="fas fa-hand-holding-box text-success"></i>' :
        '<i class="fas fa-undo text-warning"></i>';
    const typeText = isPickUp ? 'Pick Up' : 'Put Back';
    const typeBadge = isPickUp ?
        '<span class="badge bg-success"><i class="fas fa-hand-holding-box me-1"></i>Pick Up</span>' :
        '<span class="badge bg-warning text-dark"><i class="fas fa-undo me-1"></i>Put Back</span>';

    // Add special styling for master units
    if (isMasterUnit) {
        row.style.backgroundColor = '#e7f3ff';
        row.style.borderLeft = '4px solid #0066cc';
    }

    // Determine button type based on request type
    const actionButton = isPickUp ?
        `<button class="delete-btn" onclick="handleDelete('${data.serial_no}', this)">
            <i class="fas fa-trash me-1"></i>Delete
         </button>` :
        `<button class="btn btn-success btn-sm" onclick="handleDone('${data.serial_no}', this)">
            <i class="fas fa-check me-1"></i>Done
         </button>`;

    // Get the serial number for QR code (use master_unit_no if it's a master unit)
    const serialForQR = isMasterUnit ? (data.master_unit_no || data.serial_no.substring(3)) : data.serial_no;

    row.innerHTML = `
        <td style="text-align: center;">${typeBadge}</td>
        <td>${displaySerial}</td>
        <td style="text-align: center;">
            <img src="${getBarcodeUrl(serialForQR)}"
                 alt="Barcode for ${serialForQR}"
                 class="barcode-img barcode-clickable"
                 onclick="showBarcodeModal('${serialForQR}', '${getBarcodeUrl(serialForQR)}')"
                 title="Click to enlarge">
        </td>
        <td>${data.part_no}</td>
        <td>${data.revision || ''}</td>
        <td>${data.quantity}</td>
        <td>${data.location}</td>
        <td style="text-align: center;">
            <img src="${getBarcodeUrl(data.location)}"
                 alt="Barcode for ${data.location}"
                 class="barcode-img barcode-clickable"
                 onclick="showBarcodeModal('${data.location}', '${getBarcodeUrl(data.location)}')"
                 title="Click to enlarge">
        </td>
        <td>${data.deliver_to}</td>
        <td>
            ${actionButton}
        </td>
    `;

    return row;
}

// Function to show barcode in a modal popup
function showBarcodeModal(location, barcodeUrl) {
    // Create modal HTML
    const modalHTML = `
        <div class="modal fade" id="barcodeModal" tabindex="-1" aria-labelledby="barcodeModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="barcodeModalLabel">
                            <i class="fas fa-barcode me-2"></i>Location: ${location}
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body text-center p-4">
                        <img src="${barcodeUrl}" alt="Barcode for ${location}" class="barcode-modal-img">
                        <p class="mt-3 text-muted">Scan this barcode to navigate to location: <strong>${location}</strong></p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Remove any existing barcode modal
    const existingModal = document.getElementById('barcodeModal');
    if (existingModal) {
        existingModal.remove();
    }

    // Add modal to DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Show the modal
    const modal = new bootstrap.Modal(document.getElementById('barcodeModal'));
    modal.show();

    // Clean up modal from DOM when hidden
    document.getElementById('barcodeModal').addEventListener('hidden.bs.modal', function () {
        this.remove();
    });
}

// Define the correct passcode (you can change this to your desired passcode)
const CORRECT_PASSCODE = "1234";

// Function to show passcode popup
function showPasscodePopup() {
    return new Promise((resolve) => {
        // Create a custom modal using Bootstrap's modal component
        const modalHTML = `
            <div class="modal fade" id="passcodeModal" tabindex="-1" aria-labelledby="passcodeModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="passcodeModalLabel">Enter Passcode</h5>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <label for="passcodeInput" class="form-label">Please enter the passcode to delete this request:</label>
                                <input type="password" class="form-control" id="passcodeInput" placeholder="Enter numbers only" maxlength="10">
                                <div id="passcodeError" class="text-danger mt-2" style="display: none;"></div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-danger" id="confirmDeleteBtn">Delete</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Remove any existing modal
        const existingModal = document.getElementById('passcodeModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Add modal to DOM
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        const modal = new bootstrap.Modal(document.getElementById('passcodeModal'));
        const passcodeInput = document.getElementById('passcodeInput');
        const confirmBtn = document.getElementById('confirmDeleteBtn');
        const errorDiv = document.getElementById('passcodeError');
        
        // Restrict input to numbers only
        passcodeInput.addEventListener('input', function(e) {
            e.target.value = e.target.value.replace(/[^0-9]/g, '');
        });
        
        // Handle Enter key in input field
        passcodeInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                confirmBtn.click();
            }
        });
        
        // Handle confirm button click
        confirmBtn.addEventListener('click', function() {
            const enteredPasscode = passcodeInput.value.trim();
            
            if (!enteredPasscode) {
                errorDiv.textContent = 'Please enter a passcode';
                errorDiv.style.display = 'block';
                return;
            }
            
            if (enteredPasscode === CORRECT_PASSCODE) {
                modal.hide();
                resolve(true); // Passcode correct
            } else {
                errorDiv.textContent = 'Incorrect passcode. Please try again.';
                errorDiv.style.display = 'block';
                passcodeInput.value = '';
                passcodeInput.focus();
            }
        });
        
        // Handle modal close
        document.getElementById('passcodeModal').addEventListener('hidden.bs.modal', function() {
            if (!document.querySelector('.modal.show')) {
                // Only resolve false if modal was closed without successful validation
                resolve(false);
            }
            this.remove();
        });
        
        // Enhanced auto-focus functionality
        modal.show();
        
        // Multiple focus attempts to ensure it works reliably
        const focusInput = () => {
            passcodeInput.focus();
            passcodeInput.select(); // Also select any existing text
        };
        
        // Immediate focus attempt
        setTimeout(focusInput, 100);
        
        // Backup focus when modal is fully shown
        document.getElementById('passcodeModal').addEventListener('shown.bs.modal', function() {
            focusInput();
        });
        
        // Additional backup focus
        setTimeout(focusInput, 500);
    });
}

// Function to handle delete button click
async function handleDelete(serialNo, button) {
    console.log(`🗑️ Delete button clicked for serial: ${serialNo}`);

    // Show passcode popup and wait for validation
    const isPasscodeValid = await showPasscodePopup();

    if (!isPasscodeValid) {
        console.log('❌ Delete cancelled - invalid passcode or user cancelled');
        return; // Exit without deleting
    }

    console.log('✅ Passcode validated - hiding row immediately');

    // Get row reference and hide it immediately after passcode validation
    const row = button.closest('tr');
    const originalOpacity = row.style.opacity;
    const originalRowHTML = row.innerHTML; // Store original content for potential restore

    // Hide row immediately with visual feedback
    row.style.opacity = '0';
    row.style.transition = 'opacity 0.3s ease';

    try {
        console.log('🌐 Making API call to delete request');
        const response = await fetch(`/api/requests/${serialNo}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            console.log('✅ Delete request successful - removing row from DOM');

            // Remove row from DOM after successful API call
            setTimeout(() => {
                row.remove();
            }, 300); // Short delay to complete the fade animation

            // Show success message
            showAlert('Success', `Request for container ${serialNo} has been deleted.`, 'success');
        } else {
            console.error('❌ Failed to delete request - server error, restoring row');

            // Restore row visibility if API call failed
            row.style.opacity = originalOpacity || '1';
            showAlert('Error', 'Failed to delete request. Please try again.', 'danger');
        }
    } catch (error) {
        console.error('❌ Error deleting request:', error);
        console.log('🔄 Restoring row due to API error');

        // Restore row visibility if API call failed
        row.style.opacity = originalOpacity || '1';
        showAlert('Error', 'Error deleting request. Please try again.', 'danger');
    }
}

// Function to mark PUT_BACK request as done (no passcode required)
async function handleDone(serialNo, button) {
    console.log(`✅ Done button clicked for serial: ${serialNo}`);

    // Get row reference and hide it immediately
    const row = button.closest('tr');
    const originalOpacity = row.style.opacity;

    // Hide row immediately with visual feedback
    row.style.opacity = '0';
    row.style.transition = 'opacity 0.3s ease';

    try {
        console.log('🌐 Making API call to mark request as done');
        const response = await fetch(`/api/requests/${serialNo}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            console.log('✅ Request marked as done - removing row from DOM');

            // Remove row from DOM after successful API call
            setTimeout(() => {
                row.remove();
            }, 300); // Short delay to complete the fade animation

            // Show success message
            showAlert('Success', `Put back request for container ${serialNo} completed.`, 'success');
        } else {
            console.error('❌ Failed to complete request - server error, restoring row');

            // Restore row visibility if API call failed
            row.style.opacity = originalOpacity || '1';
            showAlert('Error', 'Failed to complete request. Please try again.', 'danger');
        }
    } catch (error) {
        console.error('❌ Error completing request:', error);
        console.log('🔄 Restoring row due to API error');

        // Restore row visibility if API call failed
        row.style.opacity = originalOpacity || '1';
        showAlert('Error', 'Error completing request. Please try again.', 'danger');
    }
}

// Function to show alert messages
function showAlert(title, message, type) {
    const alertHTML = `
        <div class="alert alert-${type} alert-dismissible fade show position-fixed" 
             style="top: 100px; right: 20px; z-index: 9999; min-width: 300px;" role="alert">
            <strong>${title}:</strong> ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', alertHTML);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        const alert = document.querySelector('.alert');
        if (alert) {
            alert.remove();
        }
    }, 5000);
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

// WebSocket event handlers
socket.onopen = function(e) {
    console.log("WebSocket connection established for cleanup notifications");
};

socket.onclose = function(event) {
    console.log('WebSocket connection closed. Attempting to reconnect...');
    setTimeout(() => {
        location.reload(); // Simple reconnection by reloading page
    }, 5000);
};

socket.onerror = function(error) {
    console.error('WebSocket error:', error);
};

socket.onmessage = function(event) {
    try {
        const data = JSON.parse(event.data);
        console.log("Received cleanup notification:", data);
        
        if (data.type === 'auto_cleanup_complete') {
            showAutoCleanupNotification(data);
        } else if (data.type === 'auto_cleanup_error') {
            showAutoCleanupError(data);
        }
        // Refresh the table after cleanup notifications
        setTimeout(fetchAndDisplayRequests, 1000);
    } catch (error) {
        console.error('Error parsing WebSocket message:', error);
    }
};

// Function to show auto cleanup completion notification
function showAutoCleanupNotification(data) {
    console.log('Auto cleanup completed - popups disabled');
    // Popup notifications have been disabled
    return;
}

// Function to show auto cleanup error notification
function showAutoCleanupError(data) {
    console.log('Auto cleanup error - popups disabled');
    // Popup notifications have been disabled
    return;
}

// Function to show notification popup (similar to alert but as modal)
function showNotificationPopup(title, message, type, timestamp) {
    // Create modal HTML
    const modalId = `notification_${Date.now()}`;
    const modalHTML = `
        <div class="modal fade" id="${modalId}" tabindex="-1" aria-labelledby="${modalId}Label" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header bg-${type}">
                        <h5 class="modal-title text-white" id="${modalId}Label">
                            <i class="fas fa-robot me-2"></i>${title}
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <small class="text-muted">
                                <i class="fas fa-clock me-1"></i>Auto-cleanup at ${timestamp}
                            </small>
                        </div>
                        <div class="alert alert-${type} alert-dismissible">
                            <pre class="mb-0 small" style="white-space: pre-wrap; font-family: inherit;">${message}</pre>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">OK</button>
                        <button type="button" class="btn btn-danger" data-bs-dismiss="modal">
                            <i class="fas fa-trash me-1"></i>Delete
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Remove any existing notification modals
    document.querySelectorAll('[id^="notification_"]').forEach(modal => modal.remove());
    
    // Add modal to DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById(modalId));
    modal.show();
    
    // Auto-remove modal after it's hidden
    document.getElementById(modalId).addEventListener('hidden.bs.modal', function() {
        this.remove();
    });
    
    // Auto-dismiss after 5 seconds for all auto cleanup notifications
    setTimeout(() => {
        modal.hide();
    }, 5000);
}

// --- Manual Cleanup Functions ---

async function triggerManualCleanup() {
    console.log('🧹 Manual cleanup triggered by user');
    
    const button = document.getElementById('manualCleanupBtn');
    const resultsDiv = document.getElementById('cleanupResults');
    const resultsContent = document.getElementById('cleanupResultsContent');
    
    // Show loading state
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Running Cleanup...';
    
    // Show results area
    resultsDiv.style.display = 'block';
    resultsContent.innerHTML = `
        <div class="d-flex align-items-center">
            <div class="spinner-border spinner-border-sm me-2" role="status"></div>
            <span>Running manual cleanup... This may take a few moments.</span>
        </div>
    `;
    
    try {
        console.log('🌐 Making API call to /api/cleanup/manual');
        const response = await fetch('/api/cleanup/manual', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const results = await response.json();
        console.log('✅ Cleanup results received:', results);
        
        // Check if the operation actually succeeded based on the response content
        // rather than just HTTP status code
        if (results.status === 'error') {
            throw new Error(results.message || 'Cleanup operation failed');
        }
        
        // Display results
        displayCleanupResults(results);
        
        // Refresh the table to show removed items
        setTimeout(fetchAndDisplayRequests, 1000);
        
    } catch (error) {
        console.error('❌ Error during manual cleanup:', error);
        resultsContent.innerHTML = `
            <div class="alert alert-danger">
                <strong>Error:</strong> ${error.message}
                <br><small>Check the console for more details.</small>
            </div>
        `;
    } finally {
        // Reset button
        button.disabled = false;
        button.innerHTML = '<i class="fas fa-broom"></i> Manual Cleanup';
    }
}

async function getCleanupStatus() {
    console.log('📊 Getting cleanup status');
    
    const button = document.getElementById('cleanupStatusBtn');
    const resultsDiv = document.getElementById('cleanupResults');
    const resultsContent = document.getElementById('cleanupResultsContent');
    
    // Show loading state
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
    
    try {
        const response = await fetch('/api/cleanup/status');
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const status = await response.json();
        console.log('✅ Status received:', status);
        
        // Show results area
        resultsDiv.style.display = 'block';
        
        // Display status
        displayCleanupStatus(status);
        
    } catch (error) {
        console.error('❌ Error getting status:', error);
        resultsDiv.style.display = 'block';
        resultsContent.innerHTML = `
            <div class="alert alert-danger">
                <strong>Error:</strong> ${error.message}
            </div>
        `;
    } finally {
        // Reset button
        button.disabled = false;
        button.innerHTML = '<i class="fas fa-info-circle"></i> Status';
    }
}

function displayCleanupResults(results) {
    const resultsContent = document.getElementById('cleanupResultsContent');
    
    let html = `
        <div class="row">
            <div class="col-12 mb-2">
                <button class="btn btn-sm btn-outline-secondary float-end" onclick="closeCleanupResults()">
                    <i class="fas fa-times me-1"></i>Close
                </button>
            </div>
        </div>
    `;
    
    if (results.status === 'success') {
        const alertClass = results.removed_containers > 0 ? 'alert-success' : 'alert-info';
        
        html += `
            <div class="alert ${alertClass}">
                <strong>Cleanup Completed Successfully!</strong>
                <ul class="mb-0 mt-2">
                    <li>📊 Checked ${results.checked_requests} active requests</li>
                    <li>🗑️ Removed ${results.removed_containers} containers</li>
                    <li>📍 Found ${results.prod_locations.length} production locations</li>
                </ul>
            </div>
        `;
        
        // Show removed containers details
        if (results.containers_removed && results.containers_removed.length > 0) {
            html += `
                <div class="mt-3">
                    <h6>🎯 Containers Removed (moved to production):</h6>
                    <div class="table-responsive">
                        <table class="table table-sm table-striped">
                            <thead>
                                <tr>
                                    <th>Serial No</th>
                                    <th>Part No</th>
                                    <th>From Location</th>
                                    <th>To Production Location</th>
                                    <th>Deliver To</th>
                                </tr>
                            </thead>
                            <tbody>
            `;
            
            results.containers_removed.forEach(container => {
                html += `
                    <tr>
                        <td>${container.serial_no}</td>
                        <td>${container.part_no}</td>
                        <td>${container.stored_location}</td>
                        <td><span class="badge bg-success">${container.current_location}</span></td>
                        <td>${container.deliver_to}</td>
                    </tr>
                `;
            });
            
            html += `
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }
        
        // Show errors if any
        if (results.errors && results.errors.length > 0) {
            html += `
                <div class="mt-3">
                    <h6>⚠️ Warnings/Errors:</h6>
                    <ul class="list-unstyled">
            `;
            results.errors.forEach(error => {
                html += `<li class="text-warning">• ${error}</li>`;
            });
            html += `
                    </ul>
                </div>
            `;
        }
        
    } else {
        html += `
            <div class="alert alert-danger">
                <strong>Cleanup Failed:</strong> ${results.message}
            </div>
        `;
    }
    
    resultsContent.innerHTML = html;
    
    // Auto-hide manual cleanup results after 5 seconds
    setTimeout(() => {
        const resultsDiv = document.getElementById('cleanupResults');
        if (resultsDiv) {
            resultsDiv.style.display = 'none';
        }
    }, 5000);
}

function displayCleanupStatus(status) {
    const resultsContent = document.getElementById('cleanupResultsContent');
    
    const nextRunTime = status.next_run_time ? new Date(status.next_run_time).toLocaleString() : 'Not scheduled';
    
    const html = `
        <div class="row">
            <div class="col-12 mb-2">
                <button class="btn btn-sm btn-outline-secondary float-end" onclick="closeCleanupResults()">
                    <i class="fas fa-times me-1"></i>Close
                </button>
            </div>
            <div class="col-md-6">
                <h6>🤖 Automated System Status</h6>
                <ul class="list-unstyled">
                    <li><strong>Scheduler Running:</strong> 
                        <span class="badge ${status.scheduler_running ? 'bg-success' : 'bg-danger'}">
                            ${status.scheduler_running ? 'Active' : 'Inactive'}
                        </span>
                    </li>
                    <li><strong>Cleanup Job Active:</strong> 
                        <span class="badge ${status.cleanup_job_active ? 'bg-success' : 'bg-warning'}">
                            ${status.cleanup_job_active ? 'Yes' : 'No'}
                        </span>
                    </li>
                    <li><strong>Next Automatic Run:</strong> ${nextRunTime}</li>
                    <li><strong>Total Jobs:</strong> ${status.jobs_count}</li>
                </ul>
            </div>
            <div class="col-md-6">
                <h6>📊 Current Data</h6>
                <ul class="list-unstyled">
                    <li><strong>Active Requests:</strong> 
                        <span class="badge bg-primary">${status.active_requests_count}</span>
                    </li>
                    <li><strong>System Time:</strong> ${new Date().toLocaleString()}</li>
                </ul>
                
                <div class="mt-3">
                    <button class="btn btn-sm btn-outline-info" onclick="getDetailedLogs()">
                        <i class="fas fa-list"></i> View Detailed Info
                    </button>
                </div>
            </div>
        </div>
    `;
    
    resultsContent.innerHTML = html;
    
    // Auto-hide cleanup status after 5 seconds
    setTimeout(() => {
        const resultsDiv = document.getElementById('cleanupResults');
        if (resultsDiv) {
            resultsDiv.style.display = 'none';
        }
    }, 5000);
}

async function getDetailedLogs() {
    console.log('📋 Getting detailed logs');
    
    try {
        const response = await fetch('/api/cleanup/logs');
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const logs = await response.json();
        console.log('✅ Logs received:', logs);
        
        displayDetailedLogs(logs);
        
    } catch (error) {
        console.error('❌ Error getting logs:', error);
        showAlert('Error', 'Failed to fetch detailed logs: ' + error.message, 'danger');
    }
}

function displayDetailedLogs(logs) {
    const resultsContent = document.getElementById('cleanupResultsContent');
    
    const oldestRequest = logs.oldest_request ? new Date(logs.oldest_request).toLocaleString() : 'None';
    const newestRequest = logs.newest_request ? new Date(logs.newest_request).toLocaleString() : 'None';
    
    const html = `
        <div class="row">
            <div class="col-12 mb-2">
                <button class="btn btn-sm btn-outline-secondary float-end" onclick="closeCleanupResults()">
                    <i class="fas fa-times me-1"></i>Close
                </button>
            </div>
            <div class="col-12">
                <h6>📋 Detailed System Information</h6>
                
                <div class="row">
                    <div class="col-md-6">
                        <h6 class="text-muted">📍 Production Locations (${logs.production_locations.length})</h6>
                        <div class="bg-light p-2 rounded mb-3" style="max-height: 200px; overflow-y: auto;">
                            ${logs.production_locations.map(loc => `<span class="badge bg-secondary me-1 mb-1">${loc}</span>`).join('')}
                        </div>
                    </div>
                    
                    <div class="col-md-6">
                        <h6 class="text-muted">📊 Request Statistics</h6>
                        <ul class="list-unstyled">
                            <li><strong>Total Active Requests:</strong> ${logs.total_active_requests}</li>
                            <li><strong>Oldest Request:</strong> ${oldestRequest}</li>
                            <li><strong>Newest Request:</strong> ${newestRequest}</li>
                            <li><strong>System Time:</strong> ${new Date(logs.system_time).toLocaleString()}</li>
                        </ul>
                    </div>
                </div>
                
                <div class="mt-3 text-center">
                    <button class="btn btn-sm btn-outline-secondary" onclick="getCleanupStatus()">
                        <i class="fas fa-arrow-left"></i> Back to Status
                    </button>
                </div>
            </div>
        </div>
    `;
    
    resultsContent.innerHTML = html;
    
    // Auto-hide detailed logs after 5 seconds
    setTimeout(() => {
        const resultsDiv = document.getElementById('cleanupResults');
        if (resultsDiv) {
            resultsDiv.style.display = 'none';
        }
    }, 5000);
}

// Function to close cleanup results manually
function closeCleanupResults() {
    const resultsDiv = document.getElementById('cleanupResults');
    if (resultsDiv) {
        resultsDiv.style.display = 'none';
    }
}

// socket.onopen = function(e) {
//     console.log("WebSocket connection established");
// };

// socket.onclose = function(event) {
//     console.log('WebSocket connection closed. Attempting to reconnect...');
//     setTimeout(() => {
//         socket = new WebSocket(`ws://${window.location.host}/ws`);
//     }, 1000);
// };

// socket.onerror = function(error) {
//     console.error('WebSocket error:', error);
// };

// socket.onmessage = function(event) {
//     const data = JSON.parse(event.data);
//     console.log("Received data in driver:", data);
    
//     // Handle delete signal
//     if (data.type === "delete") {
//         console.log("Processing delete signal for serial:", data.serial_no);
//         const tbody = document.getElementById("containerTableBody");
//         const rows = tbody.getElementsByTagName("tr");
//         let found = false;
        
//         for (let row of rows) {
//             const cells = row.getElementsByTagName("td");
//             if (cells[0].textContent === data.serial_no) {
//                 row.style.opacity = '0';
//                 setTimeout(() => {
//                     row.remove();
//                 }, 500);
//                 found = true;
//                 break;
//             }
//         }
        
//         if (!found) {
//             console.log("No matching row found for serial:", data.serial_no);
//         }
//         return;
//     }

//     // Handle normal container data
//     console.log("Processing normal container data");
//     const tbody = document.getElementById("containerTableBody");
//     const row = createRowElement(data);
//     tbody.appendChild(row);

//     console.log("Added new row to table");
// };


// Function to show brief status messages
function showStatusMessage(message, type) {
    // Create a temporary toast-like notification
    const statusDiv = document.createElement('div');
    statusDiv.className = `alert alert-${type} position-fixed`;
    statusDiv.style.cssText = `
        top: 80px;
        right: 20px;
        z-index: 9999;
        min-width: 250px;
        opacity: 0;
        transition: opacity 0.3s ease-in-out;
    `;
    statusDiv.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check' : 'exclamation-triangle'} me-2"></i>
        ${message}
    `;

    document.body.appendChild(statusDiv);

    // Fade in
    setTimeout(() => statusDiv.style.opacity = '1', 10);

    // Auto remove after 2 seconds
    setTimeout(() => {
        statusDiv.style.opacity = '0';
        setTimeout(() => statusDiv.remove(), 300);
    }, 2000);
}


