// Modular Firebase v10 imports via CDN (stable & compatible with v9 style)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

    // Firebase Config (using your env vars – fallback to hardcoded for testing if needed)
    const firebaseConfig = {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID,
        measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
    };

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);

    // Page elements
    const loginPage = document.getElementById('login-page');
    const studentDashboardPage = document.getElementById('student-dashboard-page');
    const teacherDashboardPage = document.getElementById('teacher-dashboard-page');
    const loginErrorElement = document.getElementById('login-error');

    // Helpers
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

    // Auth state listener
    onAuthStateChanged(auth, async user => {
        if (user) {
            const userDocRef = doc(db, 'users', user.uid);
            const userDocSnap = await getDoc(userDocRef);

            let userData;
            if (!userDocSnap.exists()) {
                userData = {
                    email: user.email,
                    displayName: user.displayName,
                    photoURL: user.photoURL,
                    role: 'student', // Default
                    createdAt: serverTimestamp()
                };
                await setDoc(userDocRef, userData);
            } else {
                userData = userDocSnap.data();
            }

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

    // Google login
    document.getElementById('google-login-btn').addEventListener('click', () => {
        const provider = new GoogleAuthProvider();
        signInWithPopup(auth, provider).catch(error => {
            loginErrorElement.style.display = 'block';
            loginErrorElement.textContent = error.message;
            showToast(error.message, 'error');
        });
    });

    // Logout buttons
    document.querySelectorAll('.logout-btn').forEach(btn => {
        btn.addEventListener('click', () => signOut(auth));
    });

    // Student dashboard
    async function setupStudentDashboard(user) {
        const main = studentDashboardPage.querySelector('main');
        
        const slotsSnap = await getDocs(query(collection(db, 'slots'), where('status', '==', 'open')));
        const bookingsSnap = await getDocs(query(collection(db, 'bookings'), where('userId', '==', user.uid)));
        
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
                                <td><button class="badge badge-active request-btn" 
                                     data-slot-id="${slot.id}"
                                     data-subject="${slot.subjectName}"
                                     data-teacher="${slot.teacherName}">Request</button></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        // Event delegation for Request buttons (functional now)
        const table = main.querySelector('table');
        if (table) {
            table.addEventListener('click', async (e) => {
                if (e.target.classList.contains('request-btn')) {
                    const btn = e.target;
                    const slotId = btn.dataset.slotId;
                    const subject = btn.dataset.subject;
                    const teacher = btn.dataset.teacher;

                    try {
                        await addDoc(collection(db, 'bookings'), {
                            userId: user.uid,
                            userName: user.displayName,
                            slotId,
                            subjectName: subject,
                            teacherName: teacher,
                            status: 'pending',
                            createdAt: serverTimestamp()
                        });
                        showToast("Request sent to " + teacher);
                        btn.disabled = true;
                        btn.textContent = "Requested";
                        btn.style.opacity = "0.6";
                    } catch (err) {
                        showToast("Error: " + err.message, 'error');
                    }
                }
            });
        }
    }

    // Teacher dashboard
    async function setupTeacherDashboard(user) {
        const main = teacherDashboardPage.querySelector('main');
        const mySlotsSnap = await getDocs(query(collection(db, 'slots'), where('teacherId', '==', user.uid)));
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
            await addDoc(collection(db, 'slots'), {
                teacherId: user.uid,
                teacherName: user.displayName,
                subjectName: document.getElementById('slot-subject').value,
                date: document.getElementById('slot-date').value,
                time: document.getElementById('slot-time').value,
                status: 'open',
                createdAt: serverTimestamp()
            });
            showToast("Slot Created!");
            setupTeacherDashboard(user);
        });
    }
});