import React, { useState, useEffect, useCallback } from "react";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from "firebase/auth";
import {
  getFirestore,
  collection,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  getDoc
} from "firebase/firestore";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import debounce from "lodash.debounce";
import "react-circular-progressbar/dist/styles.css";
import "./index.css";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import UsageMonitor from "./UsageMonitor";
// ✅ Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyB5pgUzqUc0BS8iIhOID_CNh0SrY7jzp1Y",
  authDomain: "thetaubway.firebaseapp.com",
  projectId: "thetaubway",
  storageBucket: "thetaubway.appspot.com",
  messagingSenderId: "282791499690",
  appId: "1:282791499690:web:521f2fe9d918075476fdd3",
  measurementId: "G-LLVKSJZ0CW"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getFirestore(app);
const SUBJECTS = ["Math","Language Arts","Science","Social Studies","Gym/Health","Specials"];
const  EMOJI_OPTIONS = [
  { key: "great", label: "😀 Great" },
  { key: "okay",  label: "🙂 Okay" },
  { key: "struggle", label: "😕 Struggling" },
];
const NEEDS_OPTIONS = [
  { key: "homework",  label: "Homework" },
  { key: "tests",     label: "Tests/Quizzes" },
  { key: "classwork", label: "Classroom Assignments" },
  { key: "tutoring",  label: "I need tutoring" },
];

const makeEmptyWeeklyRecord = () =>
  SUBJECTS.reduce((acc, s) => {
    acc[s] = { grade: "", mood: "", needs: { homework:false, tests:false, classwork:false, tutoring:false }, note: "" };
    return acc;
  }, {});

function App() {
  // Week calculation
  const schoolStartDate = new Date("2025-08-25");
  const currentDate = new Date();
  const currentWeekNumber = Math.floor(
    (currentDate - schoolStartDate) / (7 * 24 * 60 * 60 * 1000)
  ) + 1;
  const currentWeekKey = `Week${currentWeekNumber}`;
  const weekOptions = Array.from({ length: 40 }, (_, i) => `Week${i + 1}`);
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(localStorage.getItem("role") || "");
  const [teacherUid, setTeacherUid] = useState("");
  const [languageGoal, setLanguageGoal] = useState("");
  const [mathGoal, setMathGoal] = useState("");
  const [personalGoal, setPersonalGoal] = useState("");
  const [njslaLangScore, setNjslaLangScore] = useState("");
  const [njslaMathScore, setNjslaMathScore] = useState("");
  const [benchmarkA, setBenchmarkA] = useState("");
  const [benchmarkB, setBenchmarkB] = useState("");
  const [benchmarkC, setBenchmarkC] = 
useState("");
  const [unit1, setUnit1]=
useState("");
  const [unit2, setUnit2]=
useState("");
  const [unit3, setUnit3]=
useState("");
  const [unit4, setUnit4]=
useState("");
  const [weeklyGrades, setWeeklyGrades] = useState({});
  const [selectedGradeWeek, setSelectedGradeWeek] = useState(currentWeekKey);
  const [readingTracker, setReadingTracker] = useState({
    Monday: false,
    Tuesday: false,
    Wednesday: false,
    Thursday: false,
    Friday: false
  });
  const [readingLogs, setReadingLogs] = useState({});
  const [currentBook, setCurrentBook] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [scores, setScores] = useState([]);
  const [archivedScores, setArchivedScores] = useState([]);
  const [showResetPopup, setShowResetPopup] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedWeek, setSelectedWeek] = useState("");
  const progressData = Object.keys(readingLogs).map((week) => {
    const days = readingLogs[week] || {};
    const totalRead = Object.values(days).filter(Boolean).length;
    return { week, totalRead };
  });
  // Calculate reading streak (weeks with 4+ reading days)
  let streak = 0;
  let currentStreak = 0;
  const sortedWeeks = Object.keys(readingLogs).sort(
    (a, b) => parseInt(a.replace("Week", "")) - parseInt(b.replace("Week", ""))
  );

  sortedWeeks.forEach((week) => {
    const daysRead = Object.values(readingLogs[week] || {}).filter(Boolean).length;
    if (daysRead >= 4) {
      currentStreak += 1;
      streak = Math.max(streak, currentStreak);
    } else {
      currentStreak = 0;
    }
  });
  const [scienceGoal, setScienceGoal] = useState("");
  const[socialStudiesGoal, setSocialStudiesGoal]= useState("");
  // Marking-period goal progress (mood + note per MP)
  const defaultGoalProgress = () => ({
    language:      { MP1:{mood:"", note:""}, MP2:{mood:"", note:""}, MP3:{mood:"", note:""}, MP4:{mood:"", note:""} },
    math:          { MP1:{mood:"", note:""}, MP2:{mood:"", note:""}, MP3:{mood:"", note:""}, MP4:{mood:"", note:""} },
    science:       { MP1:{mood:"", note:""}, MP2:{mood:"", note:""}, MP3:{mood:"", note:""}, MP4:{mood:"", note:""} },
    socialStudies: { MP1:{mood:"", note:""}, MP2:{mood:"", note:""}, MP3:{mood:"", note:""}, MP4:{mood:"", note:""} },
    personal:      { MP1:{mood:"", note:""}, MP2:{mood:"", note:""}, MP3:{mood:"", note:""}, MP4:{mood:"", note:""} },
  });
  const [goalProgress, setGoalProgress] = useState(defaultGoalProgress());
  // Marking periods shown in the progress table
  const MARKING_PERIODS = ["MP1", "MP2", "MP3", "MP4"];

  // Rows for the “What’s my progress on my goal?” table
  const GOAL_ROWS = [
    { label: "📘 Language Arts", key: "language",      text: () => languageGoal },
    { label: "🧮 Math",          key: "math",          text: () => mathGoal },
    { label: "🔬 Science",       key: "science",       text: () => scienceGoal },
    { label: "🌍 Social Studies",key: "socialStudies", text: () => socialStudiesGoal },
    { label: "🌟 Personal",      key: "personal",      text: () => personalGoal },
  ];
  const colors = {
    primary: "#800020",
    accent: "#FFD700",
    background: "#F9F9F9",
    text: "#333"
  };

  const cardStyle = {
    background: "#fff",
    borderRadius: "12px",
    padding: "20px",
    margin: "20px auto",
    maxWidth: "95%",
    boxShadow: "0 4px 8px rgba(0,0,0,0.1)"
  };

  const thStyle = {
    border: "1px solid #ccc",
    padding: "8px",
    backgroundColor: colors.primary,
    color: "#fff",
    fontWeight: "bold"
  };

  const tdStyle = {
    border: "1px solid #ccc",
    padding: "8px",
    textAlign: "center"
  };

  const inputStyle = {
    width: "100%",
    padding: "10px",
    marginBottom: "10px",
    borderRadius: "6px",
    border: "1px solid #ccc"
  };

  const buttonStyle = {
    background: colors.primary,
    color: "#fff",
    padding: "10px 20px",
    margin: "10px",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "bold"
  };

  // ✅ Save Student Progress
  const saveStudentProgress = async () => {
    if (!user || role !== "student") return;
    try {
      setSaving(true);
      setSaved(false);
      const studentId = user.uid;

      const studentDocRef = doc(db, "students", studentId);
      const currentDataSnap = await getDoc(studentDocRef);
      const currentData = currentDataSnap.exists() ? currentDataSnap.data() : {};

      const studentData = {
        languageGoal,
        mathGoal,
        personalGoal,
        scienceGoal,
        socialStudiesGoal,
        goalProgress,
        njslaLangScore,
        njslaMathScore,
        benchmarkA,
        benchmarkB,
        benchmarkC,
        unit1,
        unit2,
        unit3,
        unit4,
        weeklyGrades,
        currentBook,
        readingTracker,
        readingLogs: {
          ...(currentData.readingLogs || {}),
          [currentWeekKey]: readingTracker
        },
        name: user.displayName || "",
        email: user.email || "",
        lastUpdated: new Date().toISOString()
      };

      await setDoc(studentDocRef, studentData, { merge: true });

      if (teacherUid) {
        const teacherStudentDocRef = doc(db, "teachers", teacherUid, "students", studentId);
        await setDoc(teacherStudentDocRef, studentData, { merge: true });
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error("Error saving progress:", error);
    } finally {
      setSaving(false);
    }
  };

  const debouncedSave = useCallback(debounce(saveStudentProgress, 2000), []);

  // ✅ Archive Student
  const handleArchiveStudent = async (studentId) => {
    if (!window.confirm("Are you sure you want to archive this student?")) return;

    try {
      const studentDocRef = doc(db, "teachers", teacherUid, "students", studentId);
      const studentDataSnap = await getDoc(studentDocRef);

      if (studentDataSnap.exists()) {
        const studentData = studentDataSnap.data();

        await setDoc(doc(db, "teachers", teacherUid, "archived", studentId), studentData);
        await deleteDoc(studentDocRef);
        await deleteDoc(doc(db, "students", studentId));

        alert("Student archived successfully.");
      }
    } catch (error) {
      console.error("Error archiving student:", error);
      alert("Failed to archive student.");
    }
  };

  // ✅ Restore Student
  const handleRestoreStudent = async (studentId) => {
    try {
      const archivedDocRef = doc(db, "teachers", teacherUid, "archived", studentId);
      const archivedDataSnap = await getDoc(archivedDocRef);

      if (archivedDataSnap.exists()) {
        const studentData = archivedDataSnap.data();

        await setDoc(doc(db, "teachers", teacherUid, "students", studentId), studentData);
        await deleteDoc(archivedDocRef);

        alert("Student restored successfully.");
      }
    } catch (error) {
      console.error("Error restoring student:", error);
      alert("Failed to restore student.");
    }
  };

  // ✅ Firestore Listeners
  useEffect(() => {
    if (role === "student" && user) {
      const studentDocRef = doc(db, "students", user.uid);
      const unsubscribe = onSnapshot(studentDocRef, async (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setWeeklyGrades(data.weeklyGrades || {});
          setLanguageGoal(data.languageGoal || "");
          setMathGoal(data.mathGoal || "");
          setScienceGoal(data.scienceGoal || "");
          setSocialStudiesGoal(data.socialStudiesGoal || "");      
          setPersonalGoal(data.personalGoal || "");
          setNjslaLangScore(data.njslaLangScore || "");
          setNjslaMathScore(data.njslaMathScore || "");
          setBenchmarkA(data.benchmarkA || "");
          setBenchmarkB(data.benchmarkB || "");
          setBenchmarkC(data.benchmarkC || "");
          setUnit1(data.unit1 || "");
          setUnit2(data.unit2 || "");
          setUnit3(data.unit3 || "");
          setUnit4(data.unit4 || "");
          setCurrentBook(data.currentBook || "");
          setGoalProgress(data.goalProgress || defaultGoalProgress());
          if (JSON.stringify(data.readingTracker) !== JSON.stringify(readingTracker)) {
            setReadingTracker(data.readingTracker || {
              Monday: false, Tuesday: false, Wednesday: false, Thursday: false, Friday: false
            });
          }
          setReadingLogs(data.readingLogs || {});
        }
      });
      return () => unsubscribe();
    }
  }, [role, user]);

  useEffect(() => {
    if (role === "teacher" && user) {
      setTeacherUid(user.uid);
      const studentsRef = collection(db, "teachers", user.uid, "students");
      const archivedRef = collection(db, "teachers", user.uid, "archived");

      const unsubscribeActive = onSnapshot(studentsRef, (snapshot) => {
        const list = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setScores(list);
      });

      const unsubscribeArchived = onSnapshot(archivedRef, (snapshot) => {
        const list = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setArchivedScores(list);
      });

      return () => {
        unsubscribeActive();
        unsubscribeArchived();
      };
    }
  }, [role, user]);

  // ✅ Autosave
  useEffect(() => {
    if (role === "student") {
      debouncedSave();
    }
  }, [
    languageGoal, mathGoal, scienceGoal, socialStudiesGoal, personalGoal, njslaLangScore, njslaMathScore, 
    benchmarkA, benchmarkB, benchmarkC,  currentBook, readingTracker,
    unit1, unit2, unit3, unit4, weeklyGrades,JSON.stringify(goalProgress)
  ]);

  useEffect(() => {
    if (role) localStorage.setItem("role", role);
  }, [role]);

  const toggleReadingDay = (day) => {
    setReadingTracker((prev) => ({ ...prev, [day]: !prev[day] }));
  };

  const handleLogin = () => {
    signInWithPopup(auth, provider)
      .then((result) => {
        setUser(result.user);
        setRole("");
        localStorage.removeItem("role");
      })
      .catch((error) => console.error("Login Error:", error));
  };

  const handleLogout = () => {
    signOut(auth).then(() => {
      setUser(null);
      setRole("");
      setTeacherUid("");
      localStorage.removeItem("role");
    }).catch((error) => console.error("Logout Error:", error));
  };

  const completedDays = Object.values(readingTracker).filter(Boolean).length;
  const progressPercentage = (completedDays / 5) * 100;

  return (
    <div style={{ background: colors.background, minHeight: "100vh", padding: "20px", fontFamily: "Arial, sans-serif" }}>
      {/* Banner */}
      <div style={{
        textAlign: "center",
        background: colors.primary,
        color: "#fff",
        padding: "15px",
        borderRadius: "10px",
        marginBottom: "20px",
        boxShadow: "0 4px 6px rgba(0,0,0,0.2)"
      }}>
        <img 
          src="/logo.png" 
          alt="Taub Middle School Logo" 
          style={{ 
            height: "80px", 
            width: "80px",
            borderRadius: "50%",
            border: "3px solid #FFD700",
            objectFit: "cover",
            marginBottom: "10px"
          }} 
        />
        <h1 style={{ margin: 0 }}>✨ The Taub Way ✨</h1>
        <p style={{ fontStyle: "italic", color: colors.accent }}>Passionate Lives Change Lives</p>
      </div>

      {/* Login Section */}
      {!user ? (
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <button style={{ ...buttonStyle, backgroundColor: "#4285F4" }} onClick={handleLogin}>
            Sign in with Google
          </button>
        </div>
      ) : (
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <p>Welcome, {user.displayName}</p>
          <button style={{ ...buttonStyle, backgroundColor: "#DB4437" }} onClick={handleLogout}>
            Logout
          </button>
        </div>
      )}

      {/* Role Selector */}
      {user && !role && (
        <div style={cardStyle}>
          <h2>Select Role</h2>
          <button style={buttonStyle} onClick={() => { setRole("student"); localStorage.setItem("role", "student"); }}>I am a Student</button>
          <button style={buttonStyle} onClick={() => { setRole("teacher"); localStorage.setItem("role", "teacher"); }}>I am a Teacher</button>
        </div>
      )}

      {/* Student Dashboard */}
      {role === "student" && (
        <div style={cardStyle}>
          <button style={buttonStyle} onClick={saveStudentProgress}>
            💾 Save Now
          </button>
          <h2>Student Goals</h2>

          <label>Math Goal</label>
          <input
            style={inputStyle}
            type="text"
            placeholder="Write your Math goal (Example: 'Score ≥80% on the next unit test' or 'Increase LinkIt Math score.)"
            value={mathGoal}
            onChange={(e) => setMathGoal(e.target.value)}
          />

          <label>Language Arts Goal</label>
          <input
            style={inputStyle}
            type="text"
            placeholder="Write your Language Arts goal (Example: Read 25 minutes daily' or Score ≥80% on the next benchmark)"
            value={languageGoal}
            onChange={(e) => setLanguageGoal(e.target.value)}
          />
          <label>Science Goal</label>
          <input
            style={inputStyle}
            type="text"
            placeholder="Write your Science goal (Example: 'Score ≥85% on Unit 1 test' or 'Complete every lab report on time')"
            value={scienceGoal}
            onChange={(e) => setScienceGoal(e.target.value)}
          />
          <label>Social Studies Goal</label>             <input  
            style={inputStyle} 
            type="text" 
            placeholder="Write your Social Studies goal (Example: 'Score ≥85% on Unit 1 test' or 'Complete every report on time')"   
            value={socialStudiesGoal}
            onChange={(e) => setSocialStudiesGoal(e.target.value)} 
          />        
          <label>Personal Development Goal</label>
          <input style={inputStyle} type="text" value={personalGoal} onChange={(e) => setPersonalGoal(e.target.value)} />
          <div style={cardStyle}>
            <h3>📈 My Goal Progress Tracker</h3>

            {/* DESKTOP/TABLET: classic table */}
            <table className="goal-progress__table goal-progress">
              <thead>
                <tr>
                  <th style={thStyle}>Goal</th>
                  <th style={thStyle}>MP1</th>
                  <th style={thStyle}>MP2</th>
                  <th style={thStyle}>MP3</th>
                  <th style={thStyle}>MP4</th>
                  <th style={thStyle}>Notes (for this year)</th>
                </tr>
              </thead>
              <tbody>
                {GOAL_ROWS.map(({ label, key: gKey, text }) => (
                  <tr key={gKey}>
                    <td className="goal-progress__goalcell" style={{ ...tdStyle, textAlign: "left" }}>
                      <div style={{ fontWeight: "bold" }}>{label}</div>
                      <small>{text() || "— no goal set —"}</small>
                    </td>

                    {MARKING_PERIODS.map((mp) => (
                      <td key={mp} style={tdStyle}>
                        <select
                          style={{ ...inputStyle, margin: 0, width: "100%" }}
                          value={goalProgress[gKey]?.[mp]?.mood || ""}
                          onChange={(e) => {
                            const mood = e.target.value;
                            setGoalProgress((prev) => ({
                              ...prev,
                              [gKey]: {
                                ...prev[gKey],
                                [mp]: { ...(prev[gKey]?.[mp] || { note: "" }), mood }
                              }
                            }));
                          }}
                        >
                          <option value="">— Select —</option>
                          {EMOJI_OPTIONS.map((opt) => (
                            <option key={opt.key} value={opt.key}>{opt.label}</option>
                          ))}
                        </select>
                      </td>
                    ))}

                    <td style={{ ...tdStyle, minWidth: 220 }}>
                      <textarea
                        style={{ ...inputStyle, height: 70, margin: 0 }}
                        placeholder="Add a short note/reflection"
                        value={goalProgress[gKey]?.MP4?.note || ""}
                        onChange={(e) => {
                          const note = e.target.value;
                          setGoalProgress((prev) => ({
                            ...prev,
                            [gKey]: {
                              ...prev[gKey],
                              MP4: { ...(prev[gKey]?.MP4 || { mood: "" }), note }
                            }
                          }));
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* PHONE: stacked cards */}
            <div className="goal-progress__cards goal-progress">
              {GOAL_ROWS.map(({ label, key: gKey, text }) => (
                <div key={gKey} className="goal-card">
                  <div className="goal-card__header">
                    <span className="goal-card__label">{label}</span>
                    <span className="goal-card__text">{text() || "— no goal set —"}</span>
                  </div>

                  {MARKING_PERIODS.map((mp) => (
                    <div key={mp} className="goal-card__row">
                      <label>{mp}</label>
                      <select
                        value={goalProgress[gKey]?.[mp]?.mood || ""}
                        onChange={(e) => {
                          const mood = e.target.value;
                          setGoalProgress((prev) => ({
                            ...prev,
                            [gKey]: {
                              ...prev[gKey],
                              [mp]: { ...(prev[gKey]?.[mp] || { note: "" }), mood }
                            }
                          }));
                        }}
                      >
                        <option value="">— Select —</option>
                        {EMOJI_OPTIONS.map((opt) => (
                          <option key={opt.key} value={opt.key}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  ))}

                  <div className="goal-card__row" style={{ marginTop: 6 }}>
                    <label>Notes (for this year)</label>
                    <textarea
                      placeholder="Add a short note/reflection"
                      value={goalProgress[gKey]?.MP4?.note || ""}
                      onChange={(e) => {
                        const note = e.target.value;
                        setGoalProgress((prev) => ({
                          ...prev,
                          [gKey]: {
                            ...prev[gKey],
                            MP4: { ...(prev[gKey]?.MP4 || { mood: "" }), note }
                          }
                        }));
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <h3>NJSLA Scores</h3>
          <input style={inputStyle} type="number" placeholder="Language Arts Score" value={njslaLangScore} onChange={(e) => setNjslaLangScore(e.target.value)} />
          <input style={inputStyle} type="number" placeholder="Math Score" value={njslaMathScore} onChange={(e) => setNjslaMathScore(e.target.value)} />

          <h3>LinkIt District Benchmark Scores
          </h3>
          <input style={inputStyle} type="number" placeholder="LinkIt Form A Score" value={benchmarkA} onChange={(e) => setBenchmarkA(e.target.value)} />
          <input style={inputStyle} type="number" placeholder="LinkIt Form B Score" value={benchmarkB} onChange={(e) => setBenchmarkB(e.target.value)} />
          <input style={inputStyle} type="number" placeholder="LinkIt Form C Score" value={benchmarkC} onChange={(e) => setBenchmarkC(e.target.value)} />

          <h3>Unit Scores</h3>
          <input style={inputStyle} type="number" placeholder="Unit 1 Score" value={unit1} onChange={(e) => setUnit1(e.target.value)} />
          <input style={inputStyle} type="number" placeholder="Unit 2 Score" value={unit2} onChange={(e) => setUnit2(e.target.value)} />
          <input style={inputStyle} type="number" placeholder="Unit 3 Score" value={unit3} onChange={(e) => setUnit3(e.target.value)} />
          <input style={inputStyle} type="number" placeholder="Unit 4 Score" value={unit4} onChange={(e) => setUnit4(e.target.value)} />
          {/* ✅ Weekly Grades Check-In */}
          <div style={cardStyle}>
            <h3> 🚀 My Weekly Grade Check 🚀 </h3>

            {/* Week selector (unchanged) */}
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 10 }}>
              <span>Week:</span>
              <select
                style={{ ...inputStyle, width: 160, marginBottom: 0 }}
                value={selectedGradeWeek}
                onChange={(e) => {
                  const wk = e.target.value;
                  setSelectedGradeWeek(wk);
                  setWeeklyGrades((prev) => ({
                    ...prev,
                    [wk]: prev[wk] || makeEmptyWeeklyRecord()
                  }));
                }}
              >
                {[currentWeekKey, ...weekOptions.filter((w) => w !== currentWeekKey)].map((w) => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
            </div>

            {/* DESKTOP/TABLET: table view */}
            <table className="weekly-check__table weekly-check">
              <thead>
                <tr>
                  <th style={thStyle}>Subject</th>
                  <th style={thStyle}>Grade</th>
                  <th style={thStyle}>How am I doing?</th>
                  <th style={thStyle}>Areas to Work On…</th>
                </tr>
              </thead>
              <tbody>
                {SUBJECTS.map((subj) => {
                  const wk = weeklyGrades[selectedGradeWeek] || makeEmptyWeeklyRecord();
                  const row = wk[subj] || { grade: "", mood: "", needs: {}, note: "" };

                  return (
                    <tr key={subj}>
                      <td style={{ ...tdStyle }}>{subj}</td>

                      {/* Grade */}
                      <td style={tdStyle}>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          placeholder="—"
                          value={row.grade}
                          onChange={(e) => {
                            const val = e.target.value === "" ? "" : Math.max(0, Math.min(100, Number(e.target.value)));
                            setWeeklyGrades((prev) => {
                              const next = { ...(prev[selectedGradeWeek] || makeEmptyWeeklyRecord()) };
                              next[subj] = { ...(next[subj] || {}), grade: val };
                              return { ...prev, [selectedGradeWeek]: next };
                            });
                          }}
                          style={{ ...inputStyle, margin: 0, width: 90 }}
                        />
                      </td>

                      {/* Mood */}
                      <td style={tdStyle}>
                        <select
                          value={row.mood || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setWeeklyGrades((prev) => {
                              const next = { ...(prev[selectedGradeWeek] || makeEmptyWeeklyRecord()) };
                              next[subj] = { ...(next[subj] || {}), mood: val };
                              return { ...prev, [selectedGradeWeek]: next };
                            });
                          }}
                          style={{ ...inputStyle, margin: 0, width: 180 }}
                        >
                          <option value="">— Select —</option>
                          {EMOJI_OPTIONS.map((opt) => (
                            <option key={opt.key} value={opt.key}>{opt.label}</option>
                          ))}
                        </select>
                      </td>

                      {/* Needs */}
                      <td style={{ ...tdStyle, textAlign: "left" }}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                          {NEEDS_OPTIONS.map((opt) => (
                            <label key={opt.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <input
                                type="checkbox"
                                checked={!!row.needs?.[opt.key]}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setWeeklyGrades((prev) => {
                                    const next = { ...(prev[selectedGradeWeek] || makeEmptyWeeklyRecord()) };
                                    const cur = next[subj] || { grade: "", mood: "", needs: {}, note: "" };
                                    next[subj] = {
                                      ...cur,
                                      needs: { ...(cur.needs || {}), [opt.key]: checked }
                                    };
                                    return { ...prev, [selectedGradeWeek]: next };
                                  });
                                }}
                              />
                              <span>{opt.label}</span>
                            </label>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* PHONE: card view */}
            <div className="weekly-check__cards weekly-check">
              {SUBJECTS.map((subj) => {
                const wk = weeklyGrades[selectedGradeWeek] || makeEmptyWeeklyRecord();
                const row = wk[subj] || { grade: "", mood: "", needs: {}, note: "" };

                return (
                  <div key={subj} className="weekly-card">
                    <div className="weekly-card__title">{subj}</div>

                    {/* Grade */}
                    <div className="weekly-card__row">
                      <label>Grade</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        placeholder="—"
                        value={row.grade}
                        onChange={(e) => {
                          const val = e.target.value === "" ? "" : Math.max(0, Math.min(100, Number(e.target.value)));
                          setWeeklyGrades((prev) => {
                            const next = { ...(prev[selectedGradeWeek] || makeEmptyWeeklyRecord()) };
                            next[subj] = { ...(next[subj] || {}), grade: val };
                            return { ...prev, [selectedGradeWeek]: next };
                          });
                        }}
                      />
                    </div>

                    {/* Mood */}
                    <div className="weekly-card__row">
                      <label>How am I doing?</label>
                      <select
                        value={row.mood || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setWeeklyGrades((prev) => {
                            const next = { ...(prev[selectedGradeWeek] || makeEmptyWeeklyRecord()) };
                            next[subj] = { ...(next[subj] || {}), mood: val };
                            return { ...prev, [selectedGradeWeek]: next };
                          });
                        }}
                      >
                        <option value="">— Select —</option>
                        {EMOJI_OPTIONS.map((opt) => (
                          <option key={opt.key} value={opt.key}>{opt.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Needs */}
                    <div className="weekly-card__row">
                      <label>Areas to Work On…</label>
                      <div className="weekly-card__needs">
                        {NEEDS_OPTIONS.map((opt) => (
                          <label key={opt.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <input
                              type="checkbox"
                              checked={!!row.needs?.[opt.key]}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setWeeklyGrades((prev) => {
                                  const next = { ...(prev[selectedGradeWeek] || makeEmptyWeeklyRecord()) };
                                  const cur = next[subj] || { grade: "", mood: "", needs: {}, note: "" };
                                  next[subj] = { ...cur, needs: { ...(cur.needs || {}), [opt.key]: checked } };
                                  return { ...prev, [selectedGradeWeek]: next };
                                });
                              }}
                            />
                            <span>{opt.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Weekly note (kept as-is) */}
            <div style={{ marginTop: 12 }}>
              <label style={{ fontWeight: "bold" }}>📌 Weekly Note (optional)</label>
              <textarea
                style={{ ...inputStyle, height: 80 }}
                placeholder="What will I do next week to improve?"
                value={(weeklyGrades[selectedGradeWeek]?.note) || ""}
                onChange={(e) => {
                  const text = e.target.value;
                  setWeeklyGrades((prev) => ({
                    ...prev,
                    [selectedGradeWeek]: {
                      ...(prev[selectedGradeWeek] || makeEmptyWeeklyRecord()),
                      note: text,
                    },
                  }));
                }}
              />
            </div>
          </div>

          <h3>Reading Tracker</h3>
          <div style={{ width: "120px", margin: "0 auto 20px auto" }}>
            <CircularProgressbar
              value={progressPercentage}
              text={`${completedDays}/5`}
              styles={buildStyles({
                textColor: colors.primary,
                pathColor: colors.accent,
                trailColor: "#eee"
              })}
            />
          </div>
          {Object.keys(readingTracker).map((day) => (
            <div key={day}>
              <label>
                <input type="checkbox" checked={readingTracker[day]} onChange={() => toggleReadingDay(day)} />
                I read for 20 minutes on {day}
              </label>
            </div>
          ))}

          {saving && <p style={{ color: "green" }}>Saving...</p>}
          {saved && <p style={{ color: "blue" }}>Saved ✅</p>}

          <h4>Current Book</h4>
          <input
            style={inputStyle}
            type="text"
            placeholder="Enter book title"
            value={currentBook}
            onChange={(e) => setCurrentBook(e.target.value)}
          />

          {/* 📊 Reading Progress Chart */}
          <h3>📊 Reading Progress</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={progressData}>
              <XAxis dataKey="week" />
              <YAxis domain={[0, 5]} />
              <Tooltip />
              <Bar dataKey="totalRead" fill="#800020" />
            </BarChart>
          </ResponsiveContainer>

          <p style={{ fontWeight: "bold", color: "green", textAlign: "center" }}>
            🔥 Reading Streak: {streak} weeks
          </p>

          <button style={buttonStyle} onClick={() => setRole("")}>🔙 Back</button>


        </div>
      )}

      {/* Teacher Dashboard */}
      {role === "teacher" && (
        <div style={cardStyle}>
          <h2>Teacher Dashboard</h2>
          <UsageMonitor
            students={scores.length || 997}
            savesPerStudentPerDay={3}
            teachers={1}
            colors={colors}
          />

          {/* Reading Logs with Week Selector */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <h3 style={{ margin: 0 }}>📚 Reading Logs</h3>
            <select
              style={{ ...inputStyle, width: "160px" }}
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
            >
              <option value="">Current Week ({currentWeekKey})</option>
              {weekOptions.map((week) => (
                <option key={week} value={week}>{week}</option>
              ))}
            </select>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "30px" }}>
            <thead>
              <tr>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Mon</th>
                <th style={thStyle}>Tue</th>
                <th style={thStyle}>Wed</th>
                <th style={thStyle}>Thu</th>
                <th style={thStyle}>Fri</th>
              </tr>
            </thead>
            <tbody>
              {scores.length > 0 ? (
                scores.map((entry) => {
                  const weekKey = selectedWeek || currentWeekKey;
                  const weekData = entry.readingLogs?.[weekKey] || entry.readingTracker;
                  return (
                    <tr key={entry.id}>
                      <td style={tdStyle}>{entry.name}</td>
                      {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map((day) => (
                        <td key={day} style={tdStyle}>{weekData?.[day] ? "✅" : "❌"}</td>
                      ))}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td style={tdStyle} colSpan="6">No active students yet.</td>
                </tr>
              )}
            </tbody>
          </table>


          {/* Exam Scores Table */}
          <h3>📝 Exam Scores</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "30px" }}>
            <thead>
              <tr>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>NJSLA Math</th>
                <th style={thStyle}>NJSLA Lang</th>
                <th style={thStyle}>LinkIt Form A</th>
                <th style={thStyle}>LinkIt Form B</th>
                <th style={thStyle}>LinkIt Form C</th>
              </tr>
            </thead>
            <tbody>
              {scores.length > 0 ? (
                scores.map((entry) => (
                  <tr key={entry.id}>
                    <td style={tdStyle}>{entry.name}</td>
                    <td style={tdStyle}>{entry.njslaMathScore}</td>
                    <td style={tdStyle}>{entry.njslaLangScore}</td>
                    <td style={tdStyle}>{entry.benchmarkA}</td>
                    <td style={tdStyle}>{entry.benchmarkB}</td>
                    <td style={tdStyle}>{entry.benchmarkC}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td style={tdStyle} colSpan="6">No exam scores available.</td>
                </tr>
              )}
            </tbody>
          </table>
          {/* 🧪 Unit Tests */}
          <h3>🧪 Unit Tests</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "30px" }}>
            <thead>
              <tr>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Unit 1</th>
                <th style={thStyle}>Unit 2</th>
                <th style={thStyle}>Unit 3</th>
                <th style={thStyle}>Unit 4</th>
              </tr>
            </thead>
            <tbody>
              {scores.length > 0 ? (
                scores.map((entry) => (
                  <tr key={entry.id}>
                    <td style={tdStyle}>{entry.name}</td>
                    <td style={tdStyle}>{entry.unit1}</td>
                    <td style={tdStyle}>{entry.unit2}</td>
                    <td style={tdStyle}>{entry.unit3}</td>
                    <td style={tdStyle}>{entry.unit4}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td style={tdStyle} colSpan="5">No unit test scores yet.</td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Goals Table */}
          <h3>🎯 Student Goals</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "30px" }}>
            <thead>
              <tr>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Goals</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {scores.length > 0 ? (
                scores.map((entry) => (
                  <tr key={entry.id}>
                    <td style={tdStyle}>{entry.name}</td>
                    <td style={tdStyle}>
                      <button
                        style={{
                          background: "#2196F3",
                          color: "#fff",
                          border: "none",
                          padding: "5px 10px",
                          borderRadius: "6px",
                          cursor: "pointer"
                        }}
                        onClick={() => setSelectedStudent(entry)}
                      >
                        🔍 View Goals
                      </button>
                    </td>
                    <td style={tdStyle}>
                      <button
                        style={{
                          background: "#DB4437",
                          color: "#fff",
                          border: "none",
                          padding: "5px 10px",
                          borderRadius: "6px",
                          cursor: "pointer"
                        }}
                        onClick={() => handleArchiveStudent(entry.id)}
                      >
                        🗑️ Archive
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td style={tdStyle} colSpan="3">No goals yet.</td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Archived Students */}
          <h3>📦 Archived Students</h3>
          {archivedScores.length > 0 ? (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {archivedScores.map((entry) => (
                  <tr key={entry.id}>
                    <td style={tdStyle}>{entry.name}</td>
                    <td style={tdStyle}>
                      <button
                        style={{
                          background: "#4CAF50",
                          color: "#fff",
                          border: "none",
                          padding: "5px 10px",
                          borderRadius: "6px",
                          cursor: "pointer"
                        }}
                        onClick={() => handleRestoreStudent(entry.id)}
                      >
                        ♻️ Restore
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No archived students.</p>
          )}

          <button style={buttonStyle} onClick={() => setRole("")}>🔙 Back</button>
        </div>
      )}

      {/* Goals Modal */}
      {selectedStudent && (
        <div style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          backgroundColor: "#fff",
          padding: "30px",
          borderRadius: "10px",
          boxShadow: "0 5px 15px rgba(0,0,0,0.3)",
          width: "350px",
          zIndex: 1000,
          textAlign: "left"
        }}>
          <h2 style={{ marginBottom: "20px", textAlign: "center" }}>
            {selectedStudent.name}'s Goals
          </h2>
          <div style={{ marginBottom: "15px" }}>
            <strong>📘 Language Arts Goal:</strong>
            <p>{selectedStudent.languageGoal || "No goal set"}</p>
          </div>
          <div style={{ marginBottom: "15px" }}>
            <strong>🧮 Math Goal:</strong>
            <p>{selectedStudent.mathGoal || "No goal set"}</p>
          </div>
          <div style={{ marginBottom: "15px" }}>
            <strong>🔬 Science Goal:</strong>               <p>{selectedStudent.scienceGoal || "No goal set"}</p>  
          </div>
          <div style={{ marginBottom: "15px" }}> 
            <strong>🌍 Social Studies Goal:</strong>               <p>{selectedStudent.socialStudiesGoal || "No goal set"}</p>
            </div>
          <div style={{ marginBottom: "15px" }}>
            <strong>🌟 Personal Goal:</strong>
            <p>{selectedStudent.personalGoal || "No goal set"}</p>
          </div>
          <button
            style={{
              background: "#800020",
              color: "#fff",
              border: "none",
              padding: "10px 20px",
              borderRadius: "6px",
              cursor: "pointer",
              width: "100%",
              marginTop: "10px"
            }}
            onClick={() => setSelectedStudent(null)}
          >
            Close
          
          </button>
        </div>
      )}

      {/* Weekly Reset Popup */}
      {showResetPopup && (
        <div
          style={{
            position: "fixed",
            top: "20px",
            right: "20px",
            backgroundColor: "#4CAF50",
            color: "white",
            padding: "15px 20px",
            borderRadius: "8px",
            boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
            fontWeight: "bold",
            zIndex: 1000,
            animation: "fadeSlideIn 0.5s ease-out"
          }}
        >
          🌟 “A new week means new chances to grow. Let’s crush it this week!” – Dr. Ventura
        </div>
      )}
    </div>
  );
}

export default App;






