// MENTIX — wspólna baza (Firebase / Firestore) dla PUBLICZNYCH zestawów.
// Każda przeglądarka loguje się anonimowo; zestaw może zmienić/usunąć tylko jego autor (ownerUid).
// Konfiguracja Firebase w aplikacji webowej jest publiczna z założenia — bezpieczeństwo zapewniają reguły Firestore
// (patrz firestore-mentix.rules).
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, deleteDoc, query, orderBy, limit } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyB29VUpW8zOIGBgdYPAvDvkLIX95wGhZyo',
  authDomain: 'my-games-scratch.firebaseapp.com',
  projectId: 'my-games-scratch',
  storageBucket: 'my-games-scratch.firebasestorage.app',
  messagingSenderId: '499586372781',
  appId: '1:499586372781:web:d2081ee86ae8ebecd76224'
};
const COL = 'mentix_sets';

const app = initializeApp(firebaseConfig, 'mentix');
const auth = getAuth(app);
const db = getFirestore(app);

function toSet(snap) {
  const d = snap.data();
  return {
    id: snap.id, title: d.title, desc: d.desc || '', emoji: d.emoji || '📝', visibility: 'public',
    questions: Array.isArray(d.questions) ? d.questions : [], author: d.author || '', ownerUid: d.ownerUid,
    updatedAt: d.updatedAt || 0, remote: true
  };
}

const api = {
  uid: null,
  // wszystkie publiczne zestawy (najnowsze najpierw)
  async listPublic() {
    const snap = await getDocs(query(collection(db, COL), orderBy('updatedAt', 'desc'), limit(300)));
    return snap.docs.map(toSet);
  },
  async getSet(id) {
    const s = await getDoc(doc(db, COL, id));
    return s.exists() ? toSet(s) : null;
  },
  // wysyła / aktualizuje publiczny zestaw
  async publish(set, author) {
    const data = {
      title: String(set.title).slice(0, 60),
      desc: String(set.desc || '').slice(0, 300),
      emoji: String(set.emoji || '📝').slice(0, 8),
      visibility: 'public',
      questions: JSON.parse(JSON.stringify(set.questions)),
      author: String(author || '').slice(0, 16),
      ownerUid: api.uid,
      updatedAt: Date.now()
    };
    await setDoc(doc(db, COL, set.id), data);
  },
  async unpublish(id) {
    const ref = doc(db, COL, id);
    const s = await getDoc(ref);
    if (s.exists() && s.data().ownerUid === api.uid) await deleteDoc(ref);
  }
};

signInAnonymously(auth)
  .then(cred => { api.uid = cred.user.uid; Q._cloudResolve(api); })
  .catch(err => { console.warn('MENTIX: brak połączenia z bazą', err); Q._cloudResolve(null); });
