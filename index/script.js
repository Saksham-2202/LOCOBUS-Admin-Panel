// Dashboard JS (Minimal & Expandable)

// Example: Search bar listener
const searchInput = document.querySelector('.search');
searchInput.addEventListener('input', () => {
  console.log('Searching:', searchInput.value);
});

// Placeholder functions for future Firebase integration
function fetchDashboardData() {
  console.log('Fetching dashboard data...');
}

function loadPendingApprovals() {
  console.log('Loading pending approvals...');
}

// Initial load
fetchDashboardData();
loadPendingApprovals();
