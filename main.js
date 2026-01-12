document.addEventListener('DOMContentLoaded', () => {


    // --- CALLING ENVIRONMENT VARIABLES ---
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// --- INITIALIZE FIREBASE ---
// Note: Using the compatibility (v8) syntax based on your snippet
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();


    // --- PAGE ELEMENTS ---
    const loginPage = document.getElementById('login-page');
    const studentDashboardPage = document.getElementById('student-dashboard-page');
    const teacherDashboardPage = document.getElementById('teacher-dashboard-page');
    const loginErrorElement = document.getElementById('login-error');

    // --- UI HELPERS: TOAST NOTIFICATIONS ---
    // Creates a temporary floating notification instead of an ugly alert()
    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.style.cssText = `
            position: fixed; top: 20px; right: 20px; z-index: 1000;
            padding: 15px 25px; border-radius: 8px; color: white;
            background: ${type === 'success' ? '#10b981' : '#ef4444'};
            box-shadow: 0 4px 12px rgba(0,0,0,0.15); font-family: 'Poppins', sans-serif;
            transform: translateY(-20px); opacity: 0; transition: all 0.3s ease;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);

        // Animate in
        requestAnimationFrame(() => {
            toast.style.transform = 'translateY(0)';
            toast.style.opacity = '1';
        });

        // Remove after 3 seconds
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-20px)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // --- UI HELPERS: SMOOTH SCROLL NAVIGATION ---
    // Attaches click listeners to sidebar links to scroll to sections
    function setupSidebarNavigation(role) {
        const links = document.querySelectorAll('.nav-links a');
        links.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                
                // Remove active class from all
                links.forEach(l => l.classList.remove('active'));
                // Add active to clicked
                link.classList.add('active');

                // Determine target ID based on link text or index
                const text = link.innerText.toLowerCase();
                let targetId = '';

                if (text.includes('dashboard') || text.includes('overview')) targetId = role === 'student' ? 'student-welcome-name' : 'teacher-welcome-name';
                else if (text.includes('classes') || text.includes('students')) targetId = role === 'student' ? 'my-upcoming' : 'teacher-stats';
                else if (text.includes('schedule') || text.includes('appointments')) targetId = role === 'student' ? 'available-slots' : 'pending-requests';
                else if (text.includes('resources') || text.includes('reviews')) targetId = role === 'student' ? 'testimonials-section' : 'manage-subjects';

                const targetElement = document.getElementById(targetId);
                if (targetElement) {
                    targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        });
    }

    // --- VIEW SWITCHING LOGIC ---
    function showPage(page) {
        document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
        const pageToShow = document.getElementById(page + '-page');
        if (pageToShow) {
            pageToShow.style.display = (page === 'login') ? 'flex' : 'block';
        }
    }

    // --- AUTHENTICATION LISTENER ---
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
                    role: 'student',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                await userDocRef.set(userData);
            } else {
                userData = userDoc.data();
            }

            if (userData.role === 'teacher') {
                showPage('teacher-dashboard');
                await setupTeacherDashboard(user);
                setupSidebarNavigation('teacher');
            } else {
                showPage('student-dashboard');
                await setupStudentDashboard(user);
                setupSidebarNavigation('student');
            }
            if(loginErrorElement) loginErrorElement.style.display = 'none';
        } else {
            showPage('login');
        }
    });

    // --- LOGIN/LOGOUT BUTTONS ---
    const googleBtn = document.getElementById('google-login-btn');
    if(googleBtn) {
        googleBtn.addEventListener('click', () => {
            const provider = new firebase.auth.GoogleAuthProvider();
            auth.signInWithPopup(provider).catch(handleAuthError);
        });
    }

    const msBtn = document.getElementById('microsoft-login-btn');
    if(msBtn) {
        msBtn.addEventListener('click', () => {
            const provider = new firebase.auth.OAuthProvider('microsoft.com');
            auth.signInWithPopup(provider).catch(handleAuthError);
        });
    }

    document.querySelectorAll('.logout-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            auth.signOut().then(() => {
                showToast("Logged out successfully");
            }).catch((error) => {
                console.error("Error signing out: ", error);
            });
        });
    });

    function handleAuthError(error) {
        console.error("Authentication Error:", error);
        if(loginErrorElement) {
            loginErrorElement.textContent = `Login Error: ${error.message}`;
            loginErrorElement.style.display = 'block';
        }
        showToast(error.message, 'error');
    }

    function formatDateTime(dateString, timeString) {
        const date = new Date(`${dateString}T${timeString}:00`);
        if (isNaN(date)) return 'Invalid Date/Time';
        const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        return date.toLocaleDateString('en-US', options);
    }

    // --- STUDENT DASHBOARD RENDERING ---
    async function setupStudentDashboard(user) {
        document.getElementById('student-welcome-name').textContent = `Welcome back, ${user.displayName.split(' ')[0]}!`;
        const studentAvatar = document.getElementById('student-avatar');
        if(studentAvatar) studentAvatar.innerHTML = user.photoURL ? `<img src="${user.photoURL}" alt="Avatar" style="width:100%;height:100%;border-radius:50%;">` : user.displayName.charAt(0);

        await renderStudentContent(user);
    }

    async function renderStudentContent(user) {
        const mainContent = studentDashboardPage.querySelector('main');
        // mainContent.innerHTML = `<p style="text-align:center; padding: 20px;">Loading your dashboard...</p>`; 
        // Keeping previous content while loading looks smoother

        // Fetch user's bookings and all open slots
        const myBookingsSnapshot = await db.collection('bookings').where('userId', '==', user.uid).get();
        const myBookings = myBookingsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const slotsSnapshot = await db.collection('slots').where('status', '==', 'open').get();
        const allOpenSlots = slotsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const allConfirmedBookingsSnapshot = await db.collection('bookings').where('status', '==', 'confirmed').get();
        const allConfirmedBookings = allConfirmedBookingsSnapshot.docs.map(doc => doc.data());

        const upcomingSessions = myBookings.filter(b => b.status === 'confirmed');
        const pendingRequests = myBookings.filter(b => b.status === 'pending');

        let availableSlotsHtml = '';
        if (allOpenSlots.length === 0) {
            availableSlotsHtml = '<tr><td colspan="6" style="text-align:center; padding:20px;">No mentorship slots are currently available. Check back later!</td></tr>';
        } else {
            for (const slot of allOpenSlots) {
                const teacherDoc = await db.collection('users').doc(slot.teacherId).get();
                const teacherName = teacherDoc.exists ? teacherDoc.data().displayName : 'N/A';
                const bookingsForSlot = allConfirmedBookings.filter(b => b.slotId === slot.id).length;
                const isFull = bookingsForSlot >= slot.capacity;
                const hasRequested = myBookings.some(b => b.slotId === slot.id);
                const hasConfirmed = myBookings.some(b => b.slotId === slot.id && b.status === 'confirmed');

                let actionHtml = '';
                if (isFull) {
                    actionHtml = `<span class="badge" style="background:var(--glass-border); color:#aaa;">Full</span>`;
                } else if (hasConfirmed) {
                    actionHtml = `<span class="badge badge-active">Confirmed</span>`;
                } else if (hasRequested) {
                    actionHtml = `<span class="badge badge-pending">Requested</span>`;
                } else {
                    actionHtml = `<button onclick="app.requestSlot(this, '${slot.id}', '${slot.subjectName}', '${teacherName}')" class="badge" style="background:var(--accent-blue); color:white; border:none; cursor:pointer;">Request</button>`;
                }

                availableSlotsHtml += `
                    <tr>
                        <td><strong>${teacherName}</strong></td>
                        <td>${slot.subjectName}</td>
                        <td>${formatDateTime(slot.date, slot.time)}</td>
                        <td>${slot.durationMinutes} min</td>
                        <td><span class="badge" style="background:rgba(255,255,255,0.1);">${bookingsForSlot}/${slot.capacity}</span></td>
                        <td>${actionHtml}</td>
                    </tr>
                `;
            }
        }

        // Testimonials
        const myTestimonialsSnapshot = await db.collection('testimonials').where('userId', '==', user.uid).get();
        const myTestimonials = myTestimonialsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        let myTestimonialsHtml = myTestimonials.length === 0 ? '<p style="color:var(--text-gray);">You haven\'t written any testimonials yet.</p>' : 
            myTestimonials.map(t => `<div class="glass-panel" style="padding:10px; margin-bottom:10px; border-left: 3px solid var(--accent-gold);"><p style="font-style:italic;">"${t.testimonialText}"</p></div>`).join('');

        // Updated HTML with IDs for Smooth Scrolling
        mainContent.innerHTML = `
            <div class="top-bar">
                <h2 id="student-welcome-name">Welcome back, ${user.displayName.split(' ')[0]}!</h2>
                <div class="user-profile"><div class="avatar" style="background:#3b82f6;">${user.displayName.charAt(0)}</div></div>
            </div>

            <!-- Stats Section (ID: my-upcoming) -->
            <section id="my-upcoming" class="stats-grid">
                <div class="glass-panel stat-card">
                    <p>Upcoming Sessions</p>
                    <h3>${upcomingSessions.length}</h3>
                </div>
                <div class="glass-panel stat-card">
                    <p>Pending Requests</p>
                    <h3>${pendingRequests.length}</h3>
                </div>
                <div class="glass-panel stat-card">
                    <p>Completed</p>
                    <h3>${myBookings.filter(b => b.status === 'completed').length}</h3>
                </div>
            </section>

            <!-- Available Slots (ID: available-slots) -->
            <section id="available-slots" class="dashboard-split" style="display:block;">
                <div class="glass-panel">
                    <h4 style="margin-bottom:20px;">Available Mentorship Slots</h4>
                    <div style="overflow-x:auto;">
                        <table style="width:100%; border-collapse:collapse;">
                            <thead style="text-align:left; color:var(--text-gray); border-bottom:1px solid var(--glass-border);">
                                <tr><th style="padding:10px;">Teacher</th><th>Subject</th><th>Time</th><th>Dur</th><th>Cap</th><th>Action</th></tr>
                            </thead>
                            <tbody style="font-size:0.9rem;">${availableSlotsHtml}</tbody>
                        </table>
                    </div>
                </div>
            </section>

            <!-- Testimonials (ID: testimonials-section) -->
            <section id="testimonials-section" class="glass-panel" style="margin-top:20px;">
                <h4 style="margin-bottom:15px;">Share Your Experience</h4>
                <div style="display:flex; gap:10px; margin-bottom:20px;">
                    <input id="testimonial-text" type="text" placeholder="How was your mentorship?" style="flex:1;">
                    <button onclick="app.submitTestimonial()" class="btn-primary" style="width:auto;">Submit</button>
                </div>
                <h5>Your Testimonials</h5>
                <div style="margin-top:10px;">${myTestimonialsHtml}</div>
            </section>
        `;
    }

    // --- TEACHER DASHBOARD RENDERING ---
    async function setupTeacherDashboard(user) {
        document.getElementById('teacher-welcome-name').textContent = `Welcome, ${user.displayName}!`;
        const teacherAvatar = document.getElementById('teacher-avatar');
        if(teacherAvatar) teacherAvatar.innerHTML = user.photoURL ? `<img src="${user.photoURL}" alt="Avatar" style="width:100%;height:100%;border-radius:50%;">` : "T";

        await renderTeacherContent(user);
    }

    async function renderTeacherContent(user) {
        const mainContent = teacherDashboardPage.querySelector('main');
        
        // Fetch slots & pending requests
        const mySlotsSnapshot = await db.collection('slots').where('teacherId', '==', user.uid).get();
        const mySlots = mySlotsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const mySlotIds = mySlots.map(s => s.id);

        let pendingRequests = [];
        if (mySlotIds.length > 0) {
            const pendingBookingsSnapshot = await db.collection('bookings').where('slotId', 'in', mySlotIds).where('status', '==', 'pending').get();
            pendingRequests = pendingBookingsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }

        // Requests HTML
        let requestsHtml = pendingRequests.length === 0 ? '<p style="color:var(--text-gray); text-align:center;">No pending requests at the moment.</p>' : 
        pendingRequests.map(req => `
            <div class="list-item">
                <div>
                    <strong>${req.userName}</strong> <span style="font-size:0.8rem; color:#aaa;">requested</span> <strong>${req.subjectName}</strong><br>
                    <small style="color:var(--accent-gold);">${formatDateTime(req.slotDate, req.slotTime)}</small>
                </div>
                <div style="display:flex; gap:5px;">
                    <button onclick="app.updateBookingStatus('${req.id}', 'confirmed')" style="background:#10b981; border:none; color:white; width:30px; height:30px; border-radius:50%; cursor:pointer;"><i class="fas fa-check"></i></button>
                    <button onclick="app.updateBookingStatus('${req.id}', 'declined')" style="background:#ef4444; border:none; color:white; width:30px; height:30px; border-radius:50%; cursor:pointer;"><i class="fas fa-times"></i></button>
                </div>
            </div>
        `).join('');

        // Subjects & Slots Setup
        const mySubjectsSnapshot = await db.collection('subjects').where('teacherId', '==', user.uid).get();
        const mySubjects = mySubjectsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        let subjectsOptionsHtml = '<option value="">Select Subject</option>' + mySubjects.map(sub => `<option value="${sub.id}">${sub.name}</option>`).join('');

        let mySlotsHtml = mySlots.length === 0 ? '<tr><td colspan="5" style="padding:15px; text-align:center;">No slots created yet.</td></tr>' : 
        mySlots.map(slot => `
            <tr>
                <td>${slot.subjectName}</td>
                <td>${formatDateTime(slot.date, slot.time)}</td>
                <td>${slot.durationMinutes}m</td>
                <td>${slot.capacity}</td>
                <td><button onclick="app.cancelSlot('${slot.id}')" style="color:#ef4444; background:none; border:none; cursor:pointer;">Cancel</button></td>
            </tr>
        `).join('');

        // HTML With IDs for Navigation
        mainContent.innerHTML = `
            <div class="top-bar">
                <h2 id="teacher-welcome-name">Professor ${user.displayName}</h2>
                <div class="user-profile"><div class="avatar" style="background:#10b981;">P</div></div>
            </div>

            <!-- Stats (ID: teacher-stats) -->
            <section id="teacher-stats" class="stats-grid">
                <div class="glass-panel stat-card"><p>Total Slots</p><h3>${mySlots.length}</h3></div>
                <div class="glass-panel stat-card"><p>Pending Req</p><h3>${pendingRequests.length}</h3></div>
                <div class="glass-panel stat-card"><p>My Subjects</p><h3>${mySubjects.length}</h3></div>
            </section>

            <div class="dashboard-split">
                <!-- Requests (ID: pending-requests) -->
                <div id="pending-requests" class="glass-panel">
                    <h4 style="margin-bottom:15px; border-bottom:1px solid var(--glass-border); padding-bottom:10px;">Pending Requests</h4>
                    <div>${requestsHtml}</div>
                </div>

                <!-- Create Slot (ID: manage-subjects) -->
                <div id="manage-subjects" class="glass-panel">
                    <h4 style="margin-bottom:15px;">Create New Slot</h4>
                    <form id="create-slot-form" style="display:flex; flex-direction:column; gap:10px;">
                        <select id="slot-subject" style="background:rgba(0,0,0,0.2); border:1px solid var(--glass-border); color:white; padding:10px; border-radius:5px;" required>${subjectsOptionsHtml}</select>
                        <div style="display:flex; gap:10px;">
                            <input type="date" id="slot-date" style="flex:1;" required>
                            <input type="time" id="slot-time" style="flex:1;" required>
                        </div>
                        <div style="display:flex; gap:10px;">
                            <input type="number" id="slot-duration" placeholder="Mins" style="flex:1;" required>
                            <input type="number" id="slot-capacity" placeholder="Cap" style="flex:1;" required>
                        </div>
                        <button type="submit" class="btn-primary">Create Slot</button>
                    </form>
                    
                    <div style="margin-top:20px; border-top:1px solid var(--glass-border); padding-top:10px;">
                        <h5>Add New Subject</h5>
                        <form id="create-subject-form" style="display:flex; gap:10px; margin-top:5px;">
                            <input type="text" id="subject-name" placeholder="Subject Name" required>
                            <input type="number" id="subject-price-per-minute" placeholder="Price/Min" style="width:80px;" required>
                            <button type="submit" class="btn-primary" style="width:auto;">Add</button>
                        </form>
                    </div>
                </div>
            </div>

            <div class="glass-panel" style="margin-top:20px;">
                <h4>Your Active Slots</h4>
                <table style="width:100%; margin-top:10px;">
                    <thead style="text-align:left; color:#aaa;"><tr><th>Subject</th><th>Date</th><th>Dur</th><th>Cap</th><th>Action</th></tr></thead>
                    <tbody>${mySlotsHtml}</tbody>
                </table>
            </div>
        `;

        document.getElementById('create-subject-form').addEventListener('submit', app.createSubject);
        document.getElementById('create-slot-form').addEventListener('submit', app.createSlot);
    }

    // --- INTERACTIVE APP FUNCTIONS ---
    window.app = {
        requestSlot: async (btnElement, slotId, subjectName, teacherName) => {
            if (!auth.currentUser) return showToast('Please login first', 'error');
            const user = auth.currentUser;

            // Immediate UI feedback
            const originalText = btnElement.innerText;
            btnElement.innerText = "Sending...";
            btnElement.disabled = true;

            const existing = await db.collection('bookings').where('userId', '==', user.uid).where('slotId', '==', slotId).get();

            if (!existing.empty) {
                btnElement.innerText = originalText;
                btnElement.disabled = false;
                return showToast('You already requested this slot.', 'error');
            }

            const slotDoc = await db.collection('slots').doc(slotId).get();
            if (!slotDoc.exists) return showToast('Slot no longer exists.', 'error');
            const slotData = slotDoc.data();

            try {
                await db.collection('bookings').add({
                    userId: user.uid,
                    userName: user.displayName,
                    userEmail: user.email,
                    teacherId: slotData.teacherId,
                    slotId: slotId,
                    subjectName: subjectName,
                    slotDate: slotData.date,
                    slotTime: slotData.time,
                    status: 'pending',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                showToast('Request sent! Waiting for teacher approval.');
                // Update UI without full refresh
                btnElement.innerText = "Requested";
                btnElement.style.background = "rgba(251, 191, 36, 0.2)";
                btnElement.style.color = "#fbbf24";
                
                // Optional: Refresh data after slight delay to ensure DB consistency
                setTimeout(() => renderStudentContent(user), 1000);
            } catch (error) {
                console.error(error);
                showToast('Failed to send request.', 'error');
                btnElement.innerText = originalText;
                btnElement.disabled = false;
            }
        },

        updateBookingStatus: async (bookingId, newStatus) => {
            try {
                await db.collection('bookings').doc(bookingId).update({ status: newStatus });
                showToast(`Booking ${newStatus} successfully!`);
                renderTeacherContent(auth.currentUser);
            } catch (error) {
                showToast('Action failed.', 'error');
            }
        },

        createSubject: async (event) => {
            event.preventDefault();
            const user = auth.currentUser;
            const name = document.getElementById('subject-name').value.trim();
            const price = parseFloat(document.getElementById('subject-price-per-minute').value);

            try {
                await db.collection('subjects').add({
                    name: name, pricePerDuration: price, teacherId: user.uid, teacherName: user.displayName,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                showToast('Subject added!');
                renderTeacherContent(user);
            } catch (e) { showToast('Error adding subject', 'error'); }
        },

        createSlot: async (event) => {
            event.preventDefault();
            const user = auth.currentUser;
            const subjectId = document.getElementById('slot-subject').value;
            const date = document.getElementById('slot-date').value;
            const time = document.getElementById('slot-time').value;
            const dur = parseInt(document.getElementById('slot-duration').value);
            const cap = parseInt(document.getElementById('slot-capacity').value);

            const subDoc = await db.collection('subjects').doc(subjectId).get();
            const subData = subDoc.data();

            try {
                await db.collection('slots').add({
                    subjectId: subjectId, subjectName: subData.name, teacherId: user.uid, teacherName: user.displayName,
                    date: date, time: time, durationMinutes: dur, capacity: cap, price: subData.pricePerDuration * dur,
                    status: 'open', createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                showToast('Slot created successfully!');
                renderTeacherContent(user);
            } catch (e) { showToast('Error creating slot', 'error'); }
        },

        cancelSlot: async (slotId) => {
            if (!confirm('Cancel this slot? This declines pending requests.')) return;
            try {
                await db.collection('slots').doc(slotId).update({ status: 'cancelled' });
                // Logic to decline bookings would go here in a Cloud Function ideally, but simple update for now:
                showToast('Slot cancelled.');
                renderTeacherContent(auth.currentUser);
            } catch (e) { showToast('Error cancelling.', 'error'); }
        },

        submitTestimonial: async () => {
            const text = document.getElementById('testimonial-text').value.trim();
            if (!text) return showToast('Please write a message', 'error');
            const user = auth.currentUser;
            try {
                await db.collection('testimonials').add({
                    userId: user.uid, userName: user.displayName, testimonialText: text, createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                showToast('Thanks for your feedback!');
                renderStudentContent(user);
            } catch (e) { showToast('Error submitting.', 'error'); }
        }
    };
});