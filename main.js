document.addEventListener('DOMContentLoaded', () => {

    // --- 1. FIREBASE CONFIGURATION (Using Netlify/Vite Env Vars) ---
    const firebaseConfig = {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID,
        measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
    };

    // Initialize Firebase
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    const auth = firebase.auth();
    const db = firebase.firestore();

    // --- 2. PAGE ELEMENTS ---
    const loginPage = document.getElementById('login-page');
    const studentDashboardPage = document.getElementById('student-dashboard-page');
    const teacherDashboardPage = document.getElementById('teacher-dashboard-page');
    const loginErrorElement = document.getElementById('login-error');

    // --- 3. UI HELPERS (TOASTS & NAVIGATION) ---
    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast`;
        toast.style.cssText = `
            position: fixed; top: 20px; right: 20px; z-index: 9999;
            padding: 15px 25px; border-radius: 8px; color: white;
            background: ${type === 'success' ? '#10b981' : '#ef4444'};
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    function showPage(page) {
        document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
        const target = document.getElementById(page + '-page');
        if (target) target.classList.remove('hidden');
    }

    function formatDateTime(dateString, timeString) {
        const date = new Date(`${dateString}T${timeString}:00`);
        return isNaN(date) ? 'N/A' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    // --- 4. AUTHENTICATION LISTENER ---
    auth.onAuthStateChanged(async user => {
        if (user) {
            const userDocRef = db.collection('users').doc(user.uid);
            const userDoc = await userDocRef.get();

            let userData;
            if (!userDoc.exists) {
                userData = {
                    email: user.email,
                    displayName: user.displayName,
                    photoURL: user.photoURL,
                    role: 'student', // Default new users to student
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                await userDocRef.set(userData);
            } else {
                userData = userDoc.data();
            }

            // Redirect based on role
            if (userData.role === 'teacher') {
                showPage('teacher-dashboard');
                await setupTeacherDashboard(user);
            } else {
                showPage('student-dashboard');
                await setupStudentDashboard(user);
            }
        } else {
            showPage('login');
        }
    });

    // --- 5. LOGIN ACTIONS ---
    document.getElementById('google-login-btn').addEventListener('click', () => {
        const provider = new firebase.auth.GoogleAuthProvider();
        auth.signInWithPopup(provider).catch(error => {
            loginErrorElement.style.display = 'block';
            loginErrorElement.textContent = error.message;
            showToast(error.message, 'error');
        });
    });

    document.querySelectorAll('.logout-btn').forEach(btn => {
        btn.addEventListener('click', () => auth.signOut());
    });

    // --- 6. STUDENT DASHBOARD LOGIC ---
    async function setupStudentDashboard(user) {
        const main = studentDashboardPage.querySelector('main');
        
        // Fetch Data
        const slotsSnap = await db.collection('slots').where('status', '==', 'open').get();
        const bookingsSnap = await db.collection('bookings').where('userId', '==', user.uid).get();
        
        const myBookings = bookingsSnap.docs.map(d => d.data());
        const openSlots = slotsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        main.innerHTML = `
            <div class="top-bar">
                <h2>Welcome back, ${user.displayName.split(' ')[0]}!</h2>
            </div>

            <section class="stats-grid">
                <div class="glass-panel stat-card"><p>Upcoming</p><h3>${myBookings.filter(b => b.status === 'confirmed').length}</h3></div>
                <div class="glass-panel stat-card"><p>Pending</p><h3>${myBookings.filter(b => b.status === 'pending').length}</h3></div>
            </section>

            <div class="glass-panel">
                <h4>Available Mentorship Slots</h4>
                <table>
                    <thead><tr><th>Teacher</th><th>Subject</th><th>Time</th><th>Action</th></tr></thead>
                    <tbody>
                        ${openSlots.map(slot => `
                            <tr>
                                <td>${slot.teacherName}</td>
                                <td>${slot.subjectName}</td>
                                <td>${formatDateTime(slot.date, slot.time)}</td>
                                <td><button onclick="app.requestSlot('${slot.id}', '${slot.subjectName}', '${slot.teacherName}')" class="badge badge-active" style="border:none; cursor:pointer;">Request</button></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    // --- 7. TEACHER DASHBOARD LOGIC ---
    async function setupTeacherDashboard(user) {
        const main = teacherDashboardPage.querySelector('main');
        const mySlotsSnap = await db.collection('slots').where('teacherId', '==', user.uid).get();
        const mySlots = mySlotsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        main.innerHTML = `
            <h2>Professor ${user.displayName}</h2>
            <div class="dashboard-split" style="margin-top:20px;">
                <div class="glass-panel">
                    <h4>Create New Slot</h4>
                    <form id="create-slot-form" style="display:flex; flex-direction:column; gap:10px; margin-top:15px;">
                        <input type="text" id="slot-subject" placeholder="Subject Name" required>
                        <input type="date" id="slot-date" required>
                        <input type="time" id="slot-time" required>
                        <button type="submit" class="btn btn-primary">Create Slot</button>
                    </form>
                </div>
                <div class="glass-panel">
                    <h4>Active Slots</h4>
                    <ul style="list-style:none; margin-top:10px;">
                        ${mySlots.map(s => `<li>${s.subjectName} - ${s.date}</li>`).join('')}
                    </ul>
                </div>
            </div>
        `;

        document.getElementById('create-slot-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await db.collection('slots').add({
                teacherId: user.uid,
                teacherName: user.displayName,
                subjectName: document.getElementById('slot-subject').value,
                date: document.getElementById('slot-date').value,
                time: document.getElementById('slot-time').value,
                status: 'open',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            showToast("Slot Created!");
            setupTeacherDashboard(user);
        });
    }

    // --- 8. GLOBAL APP ACTIONS ---
    window.app = {
        requestSlot: async (slotId, subject, teacher) => {
            try {
                await db.collection('bookings').add({
                    userId: auth.currentUser.uid,
                    userName: auth.currentUser.displayName,
                    slotId: slotId,
                    subjectName: subject,
                    teacherName: teacher,
                    status: 'pending',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                showToast("Request sent to " + teacher);
            } catch (err) {
                showToast("Error: " + err.message, 'error');
            }
        }
    };
});