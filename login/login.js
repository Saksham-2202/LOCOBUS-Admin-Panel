import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

  const firebaseConfig = {
    apiKey: "AIzaSyCRtx7Oyda48Hz0eu-BiNrGYiK3_36Vl-c",
    authDomain: "locobus-e4274.firebaseapp.com",
    projectId: "locobus-e4274",
    storageBucket: "locobus-e4274.firebasestorage.app",
    messagingSenderId: "296482389648",
    appId: "1:296482389648:web:1827bd92dc55c8a857e215"
  };

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  const adminIdEl = document.getElementById('adminId');   // This will now be email
  const passEl = document.getElementById('password');
  const loginBtn = document.getElementById('loginBtn');
  const errMsg = document.getElementById('errMsg');

  function showError(msg) {
    errMsg.textContent = msg;
    errMsg.style.color = 'red';
  }

  function showSuccess(msg) {
    errMsg.textContent = msg;
    errMsg.style.color = 'green';
  }

  loginBtn.addEventListener('click', loginUser);

  async function loginUser() {
    const email = adminIdEl.value.trim();
    const password = passEl.value.trim();

    if (!email || !password) {
      showError("Please enter email & password.");
      return;
    }

    loginBtn.disabled = true;
    loginBtn.textContent = "Signing in...";

    try {
      // LOGIN USING FIREBASE AUTH
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;

      // CHECK ROLE IN FIRESTORE
      const adminDoc = await getDoc(doc(db, "admins", uid));

      if (!adminDoc.exists()) {
        showError("You are NOT an admin.");
        loginBtn.disabled = false;
        loginBtn.textContent = "Sign in";
        return;
      }

      showSuccess("Login successful! Redirecting...");

      sessionStorage.setItem("adminProfile", JSON.stringify({
        uid: uid,
        role: adminDoc.data().role,
        loginTime: new Date().toISOString()
      }));

      setTimeout(() => {
        window.location.href = "../index/index.html";
      }, 1000);

    } catch (error) {
      console.log(error);
      showError("Invalid email or password.");
      loginBtn.disabled = false;
      loginBtn.textContent = "Sign in";
    }
  }
});
