// ---------- Firebase Auth Persistence (Do NOT remove) ----------
auth.setPersistence(firebase.auth.Auth.Persistence.NONE);

// ---------- UI elements ----------
const authSection = document.getElementById('authSection');
const appSection = document.getElementById('appSection');
const userArea = document.getElementById('userArea');
const userEmailEl = document.getElementById('userEmail');

const btnLogin = document.getElementById('btnLogin');
const btnSignup = document.getElementById('btnSignup');
const btnLogout = document.getElementById('btnLogout');

const authEmail = document.getElementById('authEmail');
const authPassword = document.getElementById('authPassword');

const datePicker = document.getElementById('datePicker');
const remainingEl = document.getElementById('remaining');
const totalHoursEl = document.getElementById('totalHours');

const activityTitle = document.getElementById('activityTitle');
const activityCategory = document.getElementById('activityCategory');
const activityMinutes = document.getElementById('activityMinutes');
const activityStart = document.getElementById('activityStart');

const btnAddUpdate = document.getElementById('btnAddUpdate');
const btnCancelEdit = document.getElementById('btnCancelEdit');

const activitiesList = document.getElementById('activitiesList');

const btnAnalyse = document.getElementById('btnAnalyse');
const btnExport = document.getElementById('btnExport');
const filtersEl = document.getElementById('filters');

const aiSummaryEl = document.getElementById('aiSummary');
const btnCopySummary = document.getElementById('btnCopySummary');
const btnImproveSummary = document.getElementById('btnImproveSummary');

const analyticsCanvas = document.getElementById('analyticsChart');
const barCanvas = document.getElementById('barChart');
const timelineEl = document.getElementById('timeline');

let editingActivityId = null;
let userId = null;
let currentDate = null;
let currentActivities = [];
let categoryState = {};
let doughnutChart = null;
let barChart = null;

// ---------- Auth logic ----------

// LOGIN
btnLogin.onclick = async () => {
  try {
    await auth.signInWithEmailAndPassword(authEmail.value, authPassword.value);
  } catch (e) {
    alert(e.message);
  }
};

// SIGNUP (fixed)
btnSignup.onclick = async () => {
  if (auth.currentUser) {
    alert("You are already logged in. Logout first to create a new account.");
    return;
  }
  try {
    await auth.createUserWithEmailAndPassword(authEmail.value, authPassword.value);
    alert("Account created!");
  } catch (e) {
    alert(e.message);
  }
};

// LOGOUT (FULL FIX)
btnLogout.onclick = () => {
  console.log("Logout clicked");

  auth.signOut()
    .then(() => {
      console.log("User signed out");

      // Reset UI
      authSection.classList.remove("hidden");
      appSection.classList.add("hidden");
      userArea.classList.add("hidden");

      userEmailEl.textContent = "";
      activitiesList.innerHTML = "";
      aiSummaryEl.textContent = "";

      // destroy charts
      if (doughnutChart) doughnutChart.destroy();
      if (barChart) barChart.destroy();

      doughnutChart = null;
      barChart = null;

      // Clear form
      activityTitle.value = "";
      activityCategory.value = "";
      activityMinutes.value = "";
      activityStart.value = "";

    })
    .catch((err) => {
      console.error("Logout error:", err);
      alert(err.message);
    });
};

// AUTH STATE CHANGE
auth.onAuthStateChanged(user => {
  if (user) {
    userId = user.uid;
    userEmailEl.textContent = user.email;

    authSection.classList.add('hidden');
    appSection.classList.remove('hidden');
    userArea.classList.remove('hidden');

    if (!datePicker.value) {
      const d = new Date();
      datePicker.value = d.toISOString().slice(0,10);
    }

    currentDate = datePicker.value;
    loadDay(currentDate);

  } else {
    userId = null;

    authSection.classList.remove('hidden');
    appSection.classList.add('hidden');
    userArea.classList.add('hidden');
  }
});

// ---------- Helpers ----------
function dateIdFromInput(v){ return v; }

function minutesFromTimeStr(t){
  if (!t) return null;
  const [hh,mm] = t.split(':').map(x=>parseInt(x));
  return hh*60 + mm;
}

function timeStrFromMinutes(m){
  if (m==null) return '';
  const hh = Math.floor(m/60).toString().padStart(2,'0');
  const mm = (m%60).toString().padStart(2,'0');
  return `${hh}:${mm}`;
}

function formatHours(mins){
  const h = (mins/60).toFixed(1);
  return `${h}h`;
}

// ---------- Load Day ----------
datePicker.addEventListener('change', () => {
  currentDate = datePicker.value;
  loadDay(currentDate);
});

async function loadDay(dateId){
  if (!userId || !dateId) return;

  const dayRef = db.collection('users').doc(userId).collection('days').doc(dateId);
  const doc = await dayRef.get();
  const total = doc.exists ? (doc.data().totalMinutes || 0) : 0;

  remainingEl.textContent = Math.max(0,1440 - total);
  totalHoursEl.textContent = formatHours(total);

  const actsSnap = await dayRef.collection('activities').orderBy('startMin','asc').get();
  currentActivities = [];
  actsSnap.forEach(d => currentActivities.push({ id:d.id, ...d.data() }));

  buildFilterState();
  renderActivities();
}

// ---------- Add / Edit / Delete ----------
btnAddUpdate.onclick = async () => {
  if (!userId) return alert('Login required');
  if (!currentDate) return alert('Select a date first');

  const title = activityTitle.value.trim();
  const category = activityCategory.value.trim() || 'Other';
  const minutes = parseInt(activityMinutes.value);
  const startMin = minutesFromTimeStr(activityStart.value);

  if (!title || !minutes || minutes <= 0)
    return alert('Enter title and valid minutes');

  const dayRef = db.collection('users').doc(userId).collection('days').doc(currentDate);
  const daySnap = await dayRef.get();
  const currentTotal = daySnap.exists ? (daySnap.data().totalMinutes || 0) : 0;

  let newTotal = currentTotal;
  if (editingActivityId){
    const old = currentActivities.find(a=>a.id===editingActivityId);
    newTotal = currentTotal - (old?.minutes || 0) + minutes;
  } else {
    newTotal = currentTotal + minutes;
  }

  if (newTotal > 1440)
    return alert("Total minutes cannot exceed 1440.");

  const activityObj = {
    title, category, minutes,
    startMin: startMin ?? null,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  if (editingActivityId){
    await dayRef.collection('activities').doc(editingActivityId).update(activityObj);
    editingActivityId = null;
    btnAddUpdate.textContent = "Add Activity";
    btnCancelEdit.classList.add("hidden");
  } else {
    await dayRef.collection('activities').add({ 
      ...activityObj, 
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  await dayRef.set({ totalMinutes: newTotal }, { merge:true });

  activityTitle.value = "";
  activityCategory.value = "";
  activityMinutes.value = "";
  activityStart.value = "";

  loadDay(currentDate);
};

btnCancelEdit.onclick = () => {
  editingActivityId = null;
  btnAddUpdate.textContent = "Add Activity";
  btnCancelEdit.classList.add("hidden");
};

async function doDeleteActivity(id){
  if (!confirm("Delete this activity?")) return;

  const dayRef = db.collection('users').doc(userId).collection('days').doc(currentDate);
  const doc = await dayRef.collection('activities').doc(id).get();
  if (!doc.exists) return;

  const minutes = doc.data().minutes || 0;

  await dayRef.collection('activities').doc(id).delete();

  const daySnap = await dayRef.get();
  const currentTotal = daySnap.exists ? (daySnap.data().totalMinutes || 0) : 0;

  await dayRef.set({
    totalMinutes: Math.max(0, currentTotal - minutes)
  }, { merge:true });

  loadDay(currentDate);
}

// ---------- Render Activity List ----------
function renderActivities(){
  activitiesList.innerHTML = '';

  if (!currentActivities.length){
    activitiesList.innerHTML = '<div class="muted">No activities for this date.</div>';
    btnAnalyse.disabled = true;
    return;
  }

  btnAnalyse.disabled = false;

  currentActivities.forEach(a => {
    const el = document.createElement('div');
    el.className = 'activity-card';
    el.innerHTML = `
      <div>
        <div class="activity-meta">${escapeHtml(a.title)} — <span>${a.minutes} min</span> 
          <span class="muted">(${escapeHtml(a.category)})</span></div>
        <div class="small muted">${a.startMin != null ? timeStrFromMinutes(a.startMin) : ""}</div>
      </div>
      <div class="activity-actions">
        <button class="edit-btn" data-id="${a.id}">Edit</button>
        <button class="delete-btn" data-id="${a.id}">Delete</button>
      </div>
    `;
    activitiesList.appendChild(el);
  });

  // Edit button
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.onclick = e => {
      const id = e.target.dataset.id;
      const a = currentActivities.find(x => x.id === id);
      if (!a) return;

      editingActivityId = id;
      activityTitle.value = a.title;
      activityCategory.value = a.category;
      activityMinutes.value = a.minutes;
      activityStart.value = a.startMin != null ? timeStrFromMinutes(a.startMin) : '';

      btnAddUpdate.textContent = "Update Activity";
      btnCancelEdit.classList.remove("hidden");
    };
  });

  // Delete button
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.onclick = () => doDeleteActivity(btn.dataset.id);
  });
}

// ---------- Filters ----------
function buildFilterState(){
  categoryState = {};
  currentActivities.forEach(a => categoryState[a.category] = true);
  renderFilterUI();
}

function renderFilterUI(){
  filtersEl.innerHTML = '';
  Object.keys(categoryState).forEach(cat => {
    const id = 'f_' + cat.replace(/\s+/g, '_');
    const div = document.createElement('label');
    div.className = 'filter-item';
    div.innerHTML = `
      <input type="checkbox" id="${id}" ${categoryState[cat] ? 'checked' : ''}> 
      <span>${escapeHtml(cat)}</span>
    `;
    filtersEl.appendChild(div);

    div.querySelector('input').addEventListener('change', e => {
      categoryState[cat] = e.target.checked;
      if (doughnutChart || barChart) renderCharts();
    });
  });
}

// ---------- Charts ----------
btnAnalyse.onclick = () => renderCharts();

function makeChartData(){
  const map = {};
  currentActivities.forEach(a => {
    if (categoryState[a.category]) {
      map[a.category] = (map[a.category] || 0) + a.minutes;
    }
  });

  const labels = Object.keys(map);
  const values = labels.map(l => map[l]);

  return { labels, values };
}

function renderCharts(){
  const { labels, values } = makeChartData();

  if (doughnutChart) doughnutChart.destroy();
  if (barChart) barChart.destroy();

  const colors = labels.map((_, i) => `hsl(${i * 60},70%,55%)`);

  // Doughnut Chart
  doughnutChart = new Chart(analyticsCanvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderColor: '#fff',
        borderWidth: 2
      }]
    },
    options: {
      cutout: "45%",
      plugins: {
        legend: { position: 'top' }
      }
    }
  });

  // Bar Chart
  barChart = new Chart(barCanvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors.map(c => shadeColor(c, -10)),
        borderRadius: 6
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } }
    }
  });

  renderTimeline();
  generateAISummary();
}

// ---------- Timeline ----------
function renderTimeline(){
  timelineEl.innerHTML = "";

  const width = timelineEl.clientWidth;
  const withStart = currentActivities.filter(a => a.startMin != null)
    .sort((a,b) => a.startMin - b.startMin);

  const withoutStart = currentActivities.filter(a => a.startMin == null);

  withStart.forEach(a => {
    const left = (a.startMin / 1440) * 100;
    const width = Math.max((a.minutes / 1440) * 100, 2);

    const div = document.createElement('div');
    div.className = "slot";
    div.style.left = left + "%";
    div.style.width = width + "%";
    div.style.background = randColorFor(a.category);
    div.textContent = a.title;

    div.onclick = () => {
      const newTime = prompt("Enter new start time (HH:MM)", timeStrFromMinutes(a.startMin));
      if (newTime) updateActivityStart(a.id, minutesFromTimeStr(newTime));
    };

    timelineEl.appendChild(div);
  });

  let offset = 0;
  withoutStart.forEach(a => {
    const div = document.createElement("div");
    div.className = "slot";
    div.style.left = (offset % 90) + "%";
    div.style.width = "8%";
    div.style.bottom = "8px";
    div.style.background = randColorFor(a.category);
    div.textContent = a.title;
    timelineEl.appendChild(div);
    offset += 10;
  });
}

async function updateActivityStart(id, startMin){
  const dayRef = db.collection('users').doc(userId).collection('days').doc(currentDate);
  await dayRef.collection('activities').doc(id).update({
    startMin,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  loadDay(currentDate);
}

// ---------- AI Summary ----------
function generateAISummary(){
  if (!currentActivities.length){
    aiSummaryEl.textContent = "No activities to summarize.";
    return;
  }

  const map = {};
  currentActivities.forEach(a => map[a.category] = (map[a.category] || 0) + a.minutes);

  const sorted = Object.entries(map).sort((a,b) => b[1] - a[1]);
  const top = sorted[0];
  const total = sorted.reduce((a,b) => a + b[1], 0);
  const pct = ((top[1] / total) * 100).toFixed(1);

  aiSummaryEl.textContent =
    `On ${currentDate}, you logged ${total} minutes (${formatHours(total)}). 
Top category: ${top[0]} — ${top[1]} min (${pct}%). 
Suggestion: Add small breaks every 60–90 minutes for better productivity.`;
}

btnCopySummary.onclick = () => {
  navigator.clipboard.writeText(aiSummaryEl.textContent);
  alert("Summary copied!");
};

btnImproveSummary.onclick = () => {
  aiSummaryEl.textContent +=
    "\n\nAI Tip: Try the Pomodoro technique (25/5) and schedule tasks based on focus energy.";
};

// ---------- Export PNG ----------
btnExport.onclick = () => {
  if (!doughnutChart) return alert("Analyse first.");
  const link = document.createElement('a');
  link.href = doughnutChart.toBase64Image();
  link.download = `analytics-${currentDate}.png`;
  link.click();
};

// ---------- Utilities ----------
function escapeHtml(s){
  return s ? s.replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  })[c]) : '';
}

function randColorFor(key){
  let h = 0;
  for (let i=0;i<key.length;i++) h = (h*31 + key.charCodeAt(i)) % 360;
  return `hsl(${h},70%,50%)`;
}

function shadeColor(hsl, percent){
  const m = hsl.match(/hsl\((\d+),(\d+)%,(\d+)%\)/);
  if (!m) return hsl;
  let h = +m[1], s = +m[2], l = +m[3];
  l = Math.max(0, Math.min(100, l + percent));
  return `hsl(${h},${s}%,${l}%)`;
}

// ---------- Init ----------
(function(){
  analyticsCanvas.style.height = "320px";
  barCanvas.style.height = "200px";

  document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.key === "Enter") btnAddUpdate.click();
  });
})();
