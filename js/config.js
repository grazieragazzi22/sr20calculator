// AIRCRAFT LIMITS & STATION ARMS
const ARMS = {
  frontSeats: 143.5,
  rearSeats: 180.0,
  baggage: 208.0,
  fuel: 153.8
};

const LIMITS = {
  maxTakeoffWeight: 3150,
  minTakeoffMoment: 304,
  maxTakeoffMoment: 448
};

// DISCLAIMER LOGIC
function dismissDisclaimer() {
  document.getElementById('disclaimer-modal').classList.add('hidden');
  sessionStorage.setItem('disclaimerDismissed', 'true');
}

window.addEventListener('DOMContentLoaded', () => {
  if (sessionStorage.getItem('disclaimerDismissed') === 'true') {
    const modal = document.getElementById('disclaimer-modal');
    if (modal) modal.classList.add('hidden');
  }
});