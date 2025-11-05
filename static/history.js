// History Log Frontend Functionality
class HistoryManager {
    constructor() {
        this.currentPage = 1;
        this.pageSize = 50;
        this.currentFilters = {};
        this.charts = {};
        this.statsCache = null;
        
        this.init();
    }
    
    init() {
        console.log('🚀 Initializing History Manager...');
        
        // Define the correct passcode for clearing all history
        this.CLEAR_ALL_PASSCODE = "1528814";
        
        this.setupEventListeners();
        this.loadInitialData();
        
        // Set default date range (last 7 days)
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);
        
        document.getElementById('startDateFilter').value = startDate.toISOString().split('T')[0];
        document.getElementById('endDateFilter').value = endDate.toISOString().split('T')[0];
    }
    
    setupEventListeners() {
        // Filter controls
        document.getElementById('applyFiltersBtn').addEventListener('click', () => this.applyFilters());
        document.getElementById('clearFiltersBtn').addEventListener('click', () => this.clearFilters());
        
        // Page controls
        document.getElementById('refreshBtn').addEventListener('click', () => this.refreshData());
        document.getElementById('exportBtn').addEventListener('click', () => this.showExportModal());
        document.getElementById('clearAllBtn').addEventListener('click', () => this.showClearAllModal());
        
        // Pagination
        document.getElementById('pageSizeSelect').addEventListener('change', (e) => {
            this.pageSize = parseInt(e.target.value);
            this.currentPage = 1;
            this.loadHistoryData();
        });
        
        // Export functionality
        document.getElementById('confirmExportBtn').addEventListener('click', () => this.exportData());
        
        // Enter key support for filters
        const filterInputs = ['serialNoFilter', 'partNoFilter'];
        filterInputs.forEach(id => {
            document.getElementById(id).addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.applyFilters();
                }
            });
        });
    }
    
    async loadInitialData() {
        try {
            console.log('📊 Loading initial data...');
            
            // Show loading indicators
            this.showLoading();
            
            // Load statistics and history data in parallel
            await Promise.all([
                this.loadStatistics(),
                this.loadHistoryData()
            ]);
            
            console.log('✅ Initial data loaded successfully');
            
        } catch (error) {
            console.error('❌ Error loading initial data:', error);
            this.showError('Failed to load history data. Please refresh the page.');
        }
    }
    
    async loadStatistics() {
        try {
            console.log('📈 Loading statistics...');
            
            const response = await fetch('/api/history/stats?days=30');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const stats = await response.json();
            this.statsCache = stats;
            
            this.updateStatsDashboard(stats);
            this.updateCharts(stats);
            this.updatePartPerformanceTable(stats.by_part_number);
            this.updateShiftPerformanceTable(stats.by_shift);
            
            console.log('✅ Statistics loaded and displayed');
            
        } catch (error) {
            console.error('❌ Error loading statistics:', error);
            this.showError('Failed to load statistics.');
        }
    }
    
    async loadHistoryData() {
        try {
            console.log(`📋 Loading history data (page ${this.currentPage}, size ${this.pageSize})...`);
            
            // Build query parameters
            const params = new URLSearchParams({
                page: this.currentPage.toString(),
                limit: this.pageSize.toString(),
                ...this.currentFilters
            });
            
            const response = await fetch(`/api/history?${params}`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            this.updateHistoryTable(data.data);
            this.updatePagination(data.pagination);
            
            this.hideLoading();
            console.log(`✅ Loaded ${data.data.length} history records`);
            
        } catch (error) {
            console.error('❌ Error loading history data:', error);
            this.showError('Failed to load history data.');
            this.hideLoading();
        }
    }
    
    updateStatsDashboard(stats) {
        document.getElementById('totalFulfilled').textContent = stats.overall.total_fulfilled.toLocaleString();
        document.getElementById('avgFulfillmentTime').textContent = Math.round(stats.overall.avg_fulfillment_minutes || 0);
        document.getElementById('autoFulfilled').textContent = stats.overall.auto_fulfilled.toLocaleString();
        document.getElementById('manualDeleted').textContent = stats.overall.manual_delete.toLocaleString();
    }
    
    updateCharts(stats) {
        this.createTrendsChart(stats.daily_trends);
        this.createPerformanceChart(stats.performance_breakdown);
    }
    
    createTrendsChart(dailyTrends) {
        const ctx = document.getElementById('trendsChart').getContext('2d');
        
        // Destroy existing chart if it exists
        if (this.charts.trends) {
            this.charts.trends.destroy();
        }
        
        // Handle null/undefined daily trends
        if (!dailyTrends || !Array.isArray(dailyTrends) || dailyTrends.length === 0) {
            console.warn('⚠️ No daily trends data available for chart');
            // Create empty chart
            this.charts.trends = new Chart(ctx, {
                type: 'line',
                data: { labels: [], datasets: [] },
                options: { plugins: { legend: { display: false } } }
            });
            return;
        }
        
        const labels = dailyTrends.map(item => item.date).reverse();
        const counts = dailyTrends.map(item => item.fulfilled_count).reverse();
        const avgTimes = dailyTrends.map(item => item.avg_duration_minutes).reverse();
        
        this.charts.trends = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Fulfilled Count',
                        data: counts,
                        borderColor: 'rgb(54, 162, 235)',
                        backgroundColor: 'rgba(54, 162, 235, 0.1)',
                        yAxisID: 'y'
                    },
                    {
                        label: 'Avg Duration (minutes)',
                        data: avgTimes,
                        borderColor: 'rgb(255, 99, 132)',
                        backgroundColor: 'rgba(255, 99, 132, 0.1)',
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                    }
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'day'
                        },
                        title: {
                            display: true,
                            text: 'Date'
                        }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Fulfilled Count'
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Average Duration (minutes)'
                        },
                        grid: {
                            drawOnChartArea: false,
                        },
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });
    }
    
    createPerformanceChart(performanceBreakdown) {
        const ctx = document.getElementById('performanceChart').getContext('2d');
        
        // Destroy existing chart if it exists
        if (this.charts.performance) {
            this.charts.performance.destroy();
        }
        
        // Handle null/undefined performance breakdown
        if (!performanceBreakdown || !Array.isArray(performanceBreakdown) || performanceBreakdown.length === 0) {
            console.warn('⚠️ No performance breakdown data available for chart');
            // Create empty chart
            this.charts.performance = new Chart(ctx, {
                type: 'doughnut',
                data: { labels: [], datasets: [{ data: [] }] },
                options: { plugins: { legend: { display: false } } }
            });
            return;
        }
        
        const labels = performanceBreakdown.map(item => item.category);
        const data = performanceBreakdown.map(item => item.count);
        const colors = [
            'rgba(40, 167, 69, 0.8)',   // Fast - Green
            'rgba(255, 193, 7, 0.8)',   // Medium - Yellow
            'rgba(255, 87, 34, 0.8)',   // Slow - Orange
            'rgba(244, 67, 54, 0.8)'    // Very Slow - Red
        ];
        
        this.charts.performance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors.slice(0, data.length),
                    borderColor: colors.slice(0, data.length).map(color => color.replace('0.8', '1')),
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 15,
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }
    
    updatePartPerformanceTable(partStats) {
        const container = document.getElementById('partPerformanceTable');
        
        if (!partStats || !Array.isArray(partStats) || partStats.length === 0) {
            container.innerHTML = '<p class=\"text-muted\">No part performance data available.</p>';
            return;
        }
        
        // Show top 10 parts
        const topParts = partStats.slice(0, 10);
        
        const tableHtml = `
            <div class=\"table-responsive\">
                <table class=\"table table-sm table-striped\">
                    <thead class=\"table-light\">
                        <tr>
                            <th>Part Number</th>
                            <th>Fulfilled Count</th>
                            <th>Avg Duration</th>
                            <th>Min Duration</th>
                            <th>Max Duration</th>
                            <th>Performance</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${topParts.map(part => `
                            <tr>
                                <td><strong>${part.part_no}</strong></td>
                                <td><span class=\"badge bg-primary\">${part.fulfilled_count}</span></td>
                                <td>${Math.round(part.avg_fulfillment_minutes)}m</td>
                                <td>${Math.round(part.min_fulfillment_minutes)}m</td>
                                <td>${Math.round(part.max_fulfillment_minutes)}m</td>
                                <td>
                                    ${this.getPerformanceBadge(part.avg_fulfillment_minutes)}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        
        container.innerHTML = tableHtml;
    }
    
    updateShiftPerformanceTable(shiftStats) {
        const container = document.getElementById('shiftPerformanceTable');
        
        if (!shiftStats || !Array.isArray(shiftStats) || shiftStats.length === 0) {
            container.innerHTML = '<p class=\"text-muted\">No shift performance data available.</p>';
            return;
        }
        
        const tableHtml = `
            <div class=\"table-responsive\">
                <table class=\"table table-sm table-striped\">
                    <thead class=\"table-light\">
                        <tr>
                            <th>Shift</th>
                            <th>Time Range</th>
                            <th>Fulfilled Count</th>
                            <th>Avg Duration</th>
                            <th>Performance</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${shiftStats.map(shift => `
                            <tr>
                                <td><strong>${shift.shift}</strong></td>
                                <td><small class=\"text-muted\">${shift.time_range}</small></td>
                                <td><span class=\"badge bg-primary\">${shift.fulfilled_count}</span></td>
                                <td>${Math.round(shift.avg_fulfillment_minutes)}m</td>
                                <td>
                                    ${this.getPerformanceBadge(shift.avg_fulfillment_minutes)}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        
        container.innerHTML = tableHtml;
    }
    
    getPerformanceBadge(avgMinutes) {
        if (avgMinutes <= 60) {
            return '<span class=\"badge bg-success\">Fast</span>';
        } else if (avgMinutes <= 480) {
            return '<span class=\"badge bg-warning\">Medium</span>';
        } else if (avgMinutes <= 1440) {
            return '<span class=\"badge bg-danger\">Slow</span>';
        } else {
            return '<span class=\"badge bg-dark\">Very Slow</span>';
        }
    }
    
    updateHistoryTable(historyData) {
        const tbody = document.getElementById('historyTableBody');
        
        if (!historyData || historyData.length === 0) {
            tbody.innerHTML = '<tr><td colspan=\"12\" class=\"text-center text-muted\">No history records found.</td></tr>';
            return;
        }

        tbody.innerHTML = historyData.map(record => {
            // Parse the Czech timezone timestamps
            const reqTime = new Date(record.req_time);
            const fulfilledTime = new Date(record.fulfilled_time);
            const duration = this.formatDuration(record.fulfillment_duration_minutes);

            // Format times in Czech locale
            const czechLocaleOptions = {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                timeZone: 'Europe/Prague'
            };

            // Determine request type display (default to PICK_UP for backward compatibility)
            const requestType = record.request_type || 'PICK_UP';
            const isPickUp = requestType === 'PICK_UP';
            const requestTypeBadge = isPickUp ?
                '<span class=\"badge bg-success\"><i class=\"fas fa-hand-holding-box me-1\"></i>Pick Up</span>' :
                '<span class=\"badge bg-warning text-dark\"><i class=\"fas fa-undo me-1\"></i>Put Back</span>';

            return `
                <tr>
                    <td style=\"text-align: center;\">${requestTypeBadge}</td>
                    <td><strong>${record.serial_no}</strong></td>
                    <td>${record.part_no}</td>
                    <td>${record.revision || '-'}</td>
                    <td>${record.quantity}</td>
                    <td>${record.location}</td>
                    <td>${record.deliver_to}</td>
                    <td><small>${reqTime.toLocaleString('cs-CZ', czechLocaleOptions)}</small></td>
                    <td><small>${fulfilledTime.toLocaleString('cs-CZ', czechLocaleOptions)}</small></td>
                    <td><span class=\"badge ${this.getDurationBadgeClass(record.fulfillment_duration_minutes)}\">${duration}</span></td>
                    <td><span class=\"badge ${this.getTypeBadgeClass(record.fulfillment_type)}\">${this.formatFulfillmentType(record.fulfillment_type)}</span></td>
                    <td><small>${record.current_location}</small></td>
                </tr>
            `;
        }).join('');
    }
    
    formatDuration(minutes) {
        if (minutes < 60) {
            return `${minutes}m`;
        } else if (minutes < 1440) {
            const hours = Math.floor(minutes / 60);
            const remainingMinutes = minutes % 60;
            return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
        } else {
            const days = Math.floor(minutes / 1440);
            const hours = Math.floor((minutes % 1440) / 60);
            return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
        }
    }
    
    getDurationBadgeClass(minutes) {
        if (minutes <= 60) return 'bg-success';
        if (minutes <= 480) return 'bg-warning';
        if (minutes <= 1440) return 'bg-danger';
        return 'bg-dark';
    }
    
    getTypeBadgeClass(type) {
        switch (type) {
            case 'auto_cleanup': return 'bg-success';
            case 'manual_cleanup': return 'bg-info';
            case 'manual_delete': return 'bg-warning';
            default: return 'bg-secondary';
        }
    }
    
    formatFulfillmentType(type) {
        switch (type) {
            case 'auto_cleanup': return 'Auto';
            case 'manual_cleanup': return 'Manual';
            case 'manual_delete': return 'Deleted';
            default: return type;
        }
    }
    
    updatePagination(paginationInfo) {
        const paginationContainer = document.getElementById('pagination');
        const paginationInfoElement = document.getElementById('paginationInfo');
        
        // Update pagination info
        paginationInfoElement.textContent = 
            `Showing ${((paginationInfo.current_page - 1) * this.pageSize) + 1}-${Math.min(paginationInfo.current_page * this.pageSize, paginationInfo.total_records)} of ${paginationInfo.total_records} records`;
        
        // Build pagination buttons
        let paginationHtml = '';
        
        // Previous button
        paginationHtml += `
            <li class=\"page-item ${!paginationInfo.has_prev ? 'disabled' : ''}\">
                <a class=\"page-link\" href=\"#\" onclick=\"historyManager.goToPage(${paginationInfo.current_page - 1}); return false;\">
                    <i class=\"fas fa-chevron-left\"></i>
                </a>
            </li>
        `;
        
        // Page numbers (show up to 5 pages around current page)
        const startPage = Math.max(1, paginationInfo.current_page - 2);
        const endPage = Math.min(paginationInfo.total_pages, paginationInfo.current_page + 2);
        
        if (startPage > 1) {
            paginationHtml += '<li class=\"page-item\"><a class=\"page-link\" href=\"#\" onclick=\"historyManager.goToPage(1); return false;\">1</a></li>';
            if (startPage > 2) {
                paginationHtml += '<li class=\"page-item disabled\"><span class=\"page-link\">...</span></li>';
            }
        }
        
        for (let i = startPage; i <= endPage; i++) {
            paginationHtml += `
                <li class=\"page-item ${i === paginationInfo.current_page ? 'active' : ''}\">
                    <a class=\"page-link\" href=\"#\" onclick=\"historyManager.goToPage(${i}); return false;\">${i}</a>
                </li>
            `;
        }
        
        if (endPage < paginationInfo.total_pages) {
            if (endPage < paginationInfo.total_pages - 1) {
                paginationHtml += '<li class=\"page-item disabled\"><span class=\"page-link\">...</span></li>';
            }
            paginationHtml += `<li class=\"page-item\"><a class=\"page-link\" href=\"#\" onclick=\"historyManager.goToPage(${paginationInfo.total_pages}); return false;\">${paginationInfo.total_pages}</a></li>`;
        }
        
        // Next button
        paginationHtml += `
            <li class=\"page-item ${!paginationInfo.has_next ? 'disabled' : ''}\">
                <a class=\"page-link\" href=\"#\" onclick=\"historyManager.goToPage(${paginationInfo.current_page + 1}); return false;\">
                    <i class=\"fas fa-chevron-right\"></i>
                </a>
            </li>
        `;
        
        paginationContainer.innerHTML = paginationHtml;
    }
    
    goToPage(page) {
        this.currentPage = page;
        this.loadHistoryData();
    }
    
    applyFilters() {
        console.log('🔍 Applying filters...');

        this.currentFilters = {};

        // Get filter values
        const serialNo = document.getElementById('serialNoFilter').value.trim();
        const partNo = document.getElementById('partNoFilter').value.trim();
        const requestType = document.getElementById('requestTypeFilter').value;
        const fulfillmentType = document.getElementById('fulfillmentTypeFilter').value;
        const startDate = document.getElementById('startDateFilter').value;
        const endDate = document.getElementById('endDateFilter').value;

        // Build filters object
        if (serialNo) this.currentFilters.serial_no = serialNo;
        if (partNo) this.currentFilters.part_no = partNo;
        if (requestType) this.currentFilters.request_type = requestType;
        if (fulfillmentType) this.currentFilters.fulfillment_type = fulfillmentType;
        if (startDate) this.currentFilters.start_date = startDate + 'T00:00:00';
        if (endDate) this.currentFilters.end_date = endDate + 'T23:59:59';

        // Reset to first page and reload
        this.currentPage = 1;
        this.loadHistoryData();
        
        console.log('✅ Filters applied:', this.currentFilters);
    }
    
    clearFilters() {
        console.log('🧹 Clearing filters...');
        
        // Clear filter inputs
        document.getElementById('serialNoFilter').value = '';
        document.getElementById('partNoFilter').value = '';
        document.getElementById('fulfillmentTypeFilter').value = '';
        document.getElementById('startDateFilter').value = '';
        document.getElementById('endDateFilter').value = '';
        
        // Clear filters object and reload
        this.currentFilters = {};
        this.currentPage = 1;
        this.loadHistoryData();
        
        console.log('✅ Filters cleared');
    }
    
    async refreshData() {
        console.log('🔄 Refreshing all data...');
        
        try {
            // Clear cache and reload everything
            this.statsCache = null;
            await this.loadInitialData();
            
            this.showSuccess('Data refreshed successfully');
            
        } catch (error) {
            console.error('❌ Error refreshing data:', error);
            this.showError('Failed to refresh data');
        }
    }
    
    showExportModal() {
        const modal = new bootstrap.Modal(document.getElementById('exportModal'));
        modal.show();
    }
    
    async exportData() {
        try {
            const exportType = document.querySelector('input[name=\"exportType\"]:checked').value;
            console.log(`📥 Exporting ${exportType} data...`);
            
            let params = new URLSearchParams();
            
            if (exportType === 'current') {
                // Export current filtered data
                params = new URLSearchParams({
                    limit: '10000', // Large limit to get all filtered data
                    ...this.currentFilters
                });
            } else {
                // Export all data (last 30 days)
                params = new URLSearchParams({
                    limit: '10000'
                });
            }
            
            const response = await fetch(`/api/history?${params}`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            this.downloadCSV(data.data, exportType);
            
            // Close modal
            bootstrap.Modal.getInstance(document.getElementById('exportModal')).hide();
            
            this.showSuccess('Data exported successfully');
            
        } catch (error) {
            console.error('❌ Error exporting data:', error);
            this.showError('Failed to export data');
        }
    }
    
    downloadCSV(data, exportType) {
        if (!data || data.length === 0) {
            this.showError('No data to export');
            return;
        }
        
        // Define CSV headers
        const headers = [
            'Serial No', 'Part No', 'Revision', 'Quantity', 'Location', 
            'Deliver To', 'Requested Time', 'Fulfilled Time', 'Duration (minutes)', 
            'Fulfillment Type', 'Current Location'
        ];
        
        // Convert data to CSV format
        const csvContent = [
            headers.join(','),
            ...data.map(record => [
                record.serial_no,
                record.part_no,
                record.revision || '',
                record.quantity,
                record.location,
                record.deliver_to,
                record.req_time,
                record.fulfilled_time,
                record.fulfillment_duration_minutes,
                record.fulfillment_type,
                record.current_location
            ].map(field => `\"${field}\"`).join(','))
        ].join('\r\n');
        
        // Create and trigger download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `history_${exportType}_${timestamp}.csv`;
        
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        console.log(`✅ Downloaded ${filename} with ${data.length} records`);
    }
    
    showClearAllModal() {
        const modal = new bootstrap.Modal(document.getElementById('clearAllPasscodeModal'));
        const passcodeInput = document.getElementById('clearAllPasscodeInput');
        const confirmBtn = document.getElementById('confirmClearAllBtn');
        const errorDiv = document.getElementById('clearAllPasscodeError');
        
        // Reset modal state
        passcodeInput.value = '';
        errorDiv.style.display = 'none';
        
        // Restrict input to numbers only
        passcodeInput.addEventListener('input', function(e) {
            e.target.value = e.target.value.replace(/[^0-9]/g, '');
        });
        
        // Handle Enter key in input field  
        passcodeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault(); // Prevent form submission if inside a form
                confirmBtn.click();
            }
        });
        
        // Also handle keydown as backup for better compatibility
        passcodeInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                confirmBtn.click();
            }
        });
        
        // Handle confirm button click
        const handleConfirm = async () => {
            const enteredPasscode = passcodeInput.value.trim();
            
            if (!enteredPasscode) {
                errorDiv.textContent = 'Please enter a passcode';
                errorDiv.style.display = 'block';
                return;
            }
            
            if (enteredPasscode === this.CLEAR_ALL_PASSCODE) {
                modal.hide();
                await this.clearAllHistory();
            } else {
                errorDiv.textContent = 'Incorrect passcode. Please try again.';
                errorDiv.style.display = 'block';
                passcodeInput.value = '';
                passcodeInput.focus();
            }
        };
        
        // Remove any existing event listeners and add new one
        confirmBtn.replaceWith(confirmBtn.cloneNode(true));
        document.getElementById('confirmClearAllBtn').addEventListener('click', handleConfirm);
        
        modal.show();
        
        // Focus on input when modal is shown
        setTimeout(() => {
            passcodeInput.focus();
        }, 500);
    }
    
    async clearAllHistory() {
        try {
            console.log('🗑️ Clearing all history records...');
            
            const response = await fetch('/api/history/clear-all', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            console.log('✅ Clear all history result:', result);
            
            if (result.status === 'success') {
                this.showSuccess(`Successfully deleted ${result.deleted_count} history records`);
                
                // Refresh all data to show empty state
                await this.loadInitialData();
            } else {
                this.showError('Failed to clear history records');
            }
            
        } catch (error) {
            console.error('❌ Error clearing all history:', error);
            this.showError('Error clearing history records. Please try again.');
        }
    }
    
    showLoading() {
        document.getElementById('historyLoading').style.display = 'block';
        document.getElementById('historyTable').style.opacity = '0.5';
    }
    
    hideLoading() {
        document.getElementById('historyLoading').style.display = 'none';
        document.getElementById('historyTable').style.opacity = '1';
    }
    
    showError(message) {
        this.showAlert(message, 'danger');
    }
    
    showSuccess(message) {
        this.showAlert(message, 'success');
    }
    
    showAlert(message, type) {
        const alertHtml = `
            <div class=\"alert alert-${type} alert-dismissible fade show position-fixed\" 
                 style=\"top: 100px; right: 20px; z-index: 9999; min-width: 300px;\" role=\"alert\">
                ${message}
                <button type=\"button\" class=\"btn-close\" data-bs-dismiss=\"alert\" aria-label=\"Close\"></button>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', alertHtml);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            const alert = document.querySelector('.alert');
            if (alert) {
                alert.remove();
            }
        }, 5000);
    }
}

// Initialize the history manager when the page loads
let historyManager;
document.addEventListener('DOMContentLoaded', () => {
    historyManager = new HistoryManager();
});

// Global functions for pagination (called from HTML)
window.historyManager = historyManager;