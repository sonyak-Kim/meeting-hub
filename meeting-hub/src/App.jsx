import React, { useState, useMemo, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import {
  Calendar,
  Users,
  FileText,
  CheckSquare,
  Clock,
  User,
  AlertCircle,
  Paperclip,
  Sparkles,
  Plus,
  Search,
  Share2,
  Check,
  Edit3,
  Trash2,
  ArrowLeft,
  Save,
  X,
  Upload,
  File,
  Loader2,
  ListChecks,
  CheckCircle2,
  Circle,
  Lock,
  Database,
} from 'lucide-react';

// 직급 목록
const RANK_OPTIONS = ['사원', '주임', '대리', '과장', '차장', '부장', '이사', '대표'];

// 샘플 원본 회의록 텍스트
const SAMPLE_RAW_NOTES = `2026년 11월 26일 오전 10시 제품 런칭 준비 주간 회의
참석: 김민수 팀장, 이서연 PM, 박지훈 개발자, 최유진 디자이너
작성: 이서연 PM

오늘 주간 회의에서는 12월 중순 예정된 신규 모바일 앱 v2.0 정식 런칭 일정을 점검했습니다.
먼저 10:00부터 10:20까지는 개발 진행 현황을 공유했는데, 백엔드 API 연동은 95% 완료되었고 결제 모듈 QA만 남은 상태입니다.
10:20부터 10:40까지는 디자인 시안 및 온보딩 화면 최종 확정 건을 논의했습니다. 다크모드 컬러 대비를 조금 더 높이기로 합의했습니다.
10:40부터 11:00까지는 마케팅 런칭 캠페인 및 앱스토어 심사 일정을 조율했습니다.

결정된 액션 아이템:
- 박지훈 대리: 금요일까지 결제 모듈 샌드박스 테스트 완료 및 결과 공유
- 최유진 주임: 내일 오후까지 온보딩 다크모드 수정 시안 피그마 업로드
- 김민수 부장: 다음 주 월요일 오전 중 앱스토어 및 구글 플레이 심사 제출 승인

특이사항으로는 외부 PG사 심사 지연 가능성이 있어 예비 결제 수단 안내 팝업을 미리 준비해 두기로 했습니다.`;

// Vercel 환경 변수에서 Firebase 및 Gemini 설정 읽기
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
let db = null;
if (isFirebaseConfigured) {
  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
  } catch (e) {
    console.error('Firebase init error:', e);
  }
}

const TEAM_PASSCODE = import.meta.env.VITE_TEAM_PASSCODE || '2026';

const INITIAL_DEMO_MEETINGS = [
  {
    id: 'demo-1',
    title: '2026 하반기 제품 로드맵 및 v2.0 런칭 점검',
    date: '2026-11-24',
    attendees: ['김민수 팀장', '이서연 PM', '박지훈 대리', '최유진 주임'],
    agenda: '1. v2.0 핵심 기능 개발 마감일 확정\n2. 베타 테스터 피드백 반영 우선순위\n3. 12월 마케팅 프로모션 일정 조율',
    content:
      '베타 테스트 결과 사용자 온보딩 이탈률이 기존 대비 18% 감소했습니다. 다만 초기 로딩 속도 개선을 위해 이미지 지연 로딩(Lazy Loading)을 정식 배포 전 적용하기로 합의했습니다. 마케팅팀과는 런칭 1주 전 티저 페이지를 오픈하기로 결정했습니다.',
    actions: [
      { id: 'a1', task: '이미지 지연 로딩 최적화 패치 배포', assigneeName: '박지훈', assigneeRank: '대리', done: true },
      { id: 'a2', task: '런칭 티저 페이지 배너 및 카피 확정', assigneeName: '최유진', assigneeRank: '주임', done: false },
      { id: 'a3', task: '최종 QA 체크리스트 리뷰 미팅 소집', assigneeName: '이서연', assigneeRank: '과장', done: false },
    ],
    timeline: [
      { id: 't1', time: '14:00 - 14:15', topic: '베타 테스트 지표 리뷰', note: '온보딩 완료율 74% 달성 확인' },
      { id: 't2', time: '14:15 - 14:40', topic: '성능 최적화 이슈 논의', note: '메인 배너 WebP 변환 및 지연 로딩 적용 결정' },
      { id: 't3', time: '14:40 - 15:00', topic: '마케팅 오픈 일정 합의', note: '12월 10일 티저 오픈, 12월 17일 정식 오픈' },
    ],
    author: '이서연 PM',
    notes: '외부 디자인 에이전시 산출물 납품이 하루 지연되어 내부 리소스로 일부 대체 진행함.',
    attachments: [{ name: 'v2.0_베타테스트_결과리포트.pdf', size: '2.4 MB', type: 'application/pdf' }],
  },
];

export default function App() {
  // 잠금 해제 상태 (세션 유지)
  const [isUnlocked, setIsUnlocked] = useState(() => sessionStorage.getItem('meeting_hub_unlocked') === 'true');
  const [passcodeInput, setPasscodeInput] = useState('');
  const [passcodeError, setPasscodeError] = useState(false);

  const [meetings, setMeetings] = useState([]);
  const [isLoadingDb, setIsLoadingDb] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'create' | 'edit'
  const [createStep, setCreateStep] = useState('input'); // 'input' | 'review'

  // 검색 및 필터
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAttendee, setFilterAttendee] = useState('ALL');
  const [copiedToast, setCopiedToast] = useState('');

  // AI 분석 상태
  const [rawInput, setRawInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // 폼 상태
  const emptyForm = {
    title: '',
    date: new Date().toISOString().split('T')[0],
    attendeesText: '',
    agenda: '',
    content: '',
    actions: [{ id: 'act-1', task: '', assigneeName: '', assigneeRank: '사원', done: false }],
    timeline: [{ id: 'tl-1', time: '', topic: '', note: '' }],
    author: '',
    notes: '',
    attachments: [],
  };
  const [formData, setFormData] = useState(emptyForm);

  // Firebase 실시간 구독 또는 로컬 데모 폴백
  useEffect(() => {
    if (db) {
      const q = query(collection(db, 'meetings'), orderBy('date', 'desc'));
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const list = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          }));
          setMeetings(list);
          setIsLoadingDb(false);
        },
        (err) => {
          console.error('Firestore listen error:', err);
          setMeetings(INITIAL_DEMO_MEETINGS);
          setIsLoadingDb(false);
        }
      );
      return () => unsubscribe();
    } else {
      setMeetings(INITIAL_DEMO_MEETINGS);
      setIsLoadingDb(false);
    }
  }, []);

  // URL 파라미터(?meetingId=...) 자동 오픈
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedId = params.get('meetingId');
    if (sharedId && meetings.some((m) => m.id === sharedId)) {
      setSelectedId(sharedId);
    } else if (!selectedId && meetings.length > 0 && viewMode === 'list') {
      setSelectedId(meetings[0].id);
    }
  }, [meetings]);

  const handleUnlock = (e) => {
    e.preventDefault();
    if (passcodeInput.trim() === TEAM_PASSCODE) {
      sessionStorage.setItem('meeting_hub_unlocked', 'true');
      setIsUnlocked(true);
      setPasscodeError(false);
    } else {
      setPasscodeError(true);
    }
  };

  const selectedMeeting = useMemo(
    () => meetings.find((m) => m.id === selectedId) || null,
    [meetings, selectedId]
  );

  const allAttendees = useMemo(() => {
    const set = new Set();
    meetings.forEach((m) => (m.attendees || []).forEach((a) => set.add(a)));
    return Array.from(set);
  }, [meetings]);

  const filteredMeetings = useMemo(() => {
    return meetings.filter((m) => {
      const q = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !q ||
        (m.title || '').toLowerCase().includes(q) ||
        (m.agenda || '').toLowerCase().includes(q) ||
        (m.content || '').toLowerCase().includes(q) ||
        (m.author || '').toLowerCase().includes(q) ||
        (m.notes || '').toLowerCase().includes(q) ||
        (m.attendees || []).some((a) => a.toLowerCase().includes(q)) ||
        (m.actions || []).some(
          (a) =>
            (a.task || '').toLowerCase().includes(q) ||
            (a.assigneeName || '').toLowerCase().includes(q) ||
            (a.assigneeRank || '').toLowerCase().includes(q)
        );
      const matchesAttendee = filterAttendee === 'ALL' || (m.attendees || []).includes(filterAttendee);
      return matchesQuery && matchesAttendee;
    });
  }, [meetings, searchQuery, filterAttendee]);

  const showToast = (msg) => {
    setCopiedToast(msg);
    setTimeout(() => setCopiedToast(''), 2800);
  };

  const handleShareLink = (meetingId = null) => {
    const url = new URL(window.location.href);
    if (meetingId) {
      url.searchParams.set('meetingId', meetingId);
    } else {
      url.searchParams.delete('meetingId');
    }
    navigator.clipboard?.writeText(url.toString());
    showToast(
      meetingId
        ? '해당 회의록 공유 링크가 복사되었습니다!'
        : '전체 회의록 허브 공유 링크가 복사되었습니다!'
    );
  };

  // 액션 아이템 완료 토글 (실시간 DB 반영)
  const toggleActionDone = async (meetingId, actionId) => {
    const target = meetings.find((m) => m.id === meetingId);
    if (!target) return;
    const updatedActions = (target.actions || []).map((act) =>
      act.id === actionId ? { ...act, done: !act.done } : act
    );

    if (db) {
      await updateDoc(doc(db, 'meetings', meetingId), { actions: updatedActions });
    } else {
      setMeetings((prev) =>
        prev.map((m) => (m.id === meetingId ? { ...m, actions: updatedActions } : m))
      );
    }
  };

  // Gemini AI 자동 분류 호출
  const handleAnalyzeWithAI = async () => {
    if (!rawInput.trim()) {
      setAnalyzeError('분류할 회의 메모나 녹취 내용을 입력해 주세요.');
      return;
    }
    setIsAnalyzing(true);
    setAnalyzeError('');

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
    const prompt = `다음 회의 메모를 분석하여 정확한 JSON 형식으로 구조화해 주세요.
모든 필드는 한국어로 자연스럽고 명확하게 작성하고, 없는 정보는 빈 문자열이나 빈 배열로 두세요.
특히 actions의 assigneeRank는 반드시 ["사원", "주임", "대리", "과장", "차장", "부장", "이사", "대표"] 중 가장 적절한 값 하나를 선택하고, 직급 언급이 없으면 "사원"으로 설정하세요. assigneeName에는 직급을 제외한 순수 이름만 넣으세요.

필수 JSON 스키마:
{
  "title": "회의 핵심 주제를 요약한 제목",
  "date": "YYYY-MM-DD 형식의 날짜 (언급이 없으면 오늘 날짜 ${new Date().toISOString().split('T')[0]})",
  "attendees": ["참석자1", "참석자2"],
  "agenda": "주요 안건 목록 (줄바꿈으로 구분)",
  "content": "회의 핵심 논의 및 결정 사항 요약",
  "actions": [
    { "task": "할 일 내용", "assigneeName": "담당자 이름", "assigneeRank": "사원|주임|대리|과장|차장|부장|이사|대표" }
  ],
  "timeline": [
    { "time": "시간대 (예: 10:00 - 10:20)", "topic": "안건명", "note": "세부 진행 내용" }
  ],
  "author": "작성자 이름",
  "notes": "특이사항, 리스크, 참고 메모"
}

회의 원문:
"""
${rawInput}
"""`;

    try {
      if (!apiKey) {
        throw new Error('NO_API_KEY');
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
            },
          }),
        }
      );

      if (!response.ok) throw new Error('API 호출 실패');

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('응답 파싱 실패');

      const parsed = JSON.parse(text);
      applyParsedToForm(parsed);
    } catch (err) {
      const fallback = smartLocalParser(rawInput);
      applyParsedToForm(fallback);
      if (err.message === 'NO_API_KEY') {
        showToast('스마트 규칙 분류가 완료되었습니다. (Vercel에 Gemini API 키 등록 시 AI 심층 분석 활성화)');
      } else {
        showToast('자동 분류가 완료되었습니다. 내용을 검토해 주세요.');
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const smartLocalParser = (text) => {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const dateMatch = text.match(/(\d{4})[년.-]\s*(\d{1,2})[월.-]\s*(\d{1,2})/);
    const date = dateMatch
      ? `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`
      : new Date().toISOString().split('T')[0];

    const attendeeLine = lines.find((l) => l.startsWith('참석'));
    const attendees = attendeeLine
      ? attendeeLine.replace(/^참석(자)?\s*[:：]\s*/, '').split(/[,，]/).map((s) => s.trim()).filter(Boolean)
      : [];

    const authorLine = lines.find((l) => l.startsWith('작성'));
    const author = authorLine ? authorLine.replace(/^작성(자)?\s*[:：]\s*/, '').trim() : '';

    const noteLine = lines.find((l) => l.includes('특이사항'));
    const notes = noteLine ? noteLine.replace(/^.*특이사항(으로는|은|:|：)?\s*/, '').trim() : '';

    const actions = [];
    const timeline = [];

    lines.forEach((line) => {
      const timeMatch = line.match(/(\d{1,2}:\d{2}\s*(?:~|-|부터)\s*\d{1,2}:\d{2})/);
      if (timeMatch) {
        timeline.push({
          time: timeMatch[1].replace('부터', '-').replace('까지', ''),
          topic: line.replace(timeMatch[0], '').replace(/^[:：\s-]+/, '').slice(0, 35),
          note: line,
        });
      }
      if (line.startsWith('-') || line.startsWith('•')) {
        const clean = line.replace(/^[-•]\s*/, '');
        const parts = clean.split(/[:：]/);
        if (parts.length >= 2) {
          const rawPerson = parts[0].trim();
          const matchedRank = RANK_OPTIONS.find((r) => rawPerson.includes(r)) || '사원';
          const cleanName = rawPerson
            .replace(new RegExp(`\\s*(${RANK_OPTIONS.join('|')})\\s*$`), '')
            .trim();
          actions.push({
            assigneeName: cleanName || rawPerson,
            assigneeRank: matchedRank,
            task: parts.slice(1).join(':').trim(),
          });
        } else {
          actions.push({ assigneeName: '', assigneeRank: '사원', task: clean });
        }
      }
    });

    return {
      title: lines[0]?.slice(0, 45) || '신규 회의록',
      date,
      attendees,
      agenda: timeline.map((t, idx) => `${idx + 1}. ${t.topic}`).join('\n') || '주요 안건 정리',
      content: lines.filter((l) => !l.startsWith('참석') && !l.startsWith('작성')).join('\n'),
      actions: actions.length ? actions : [{ task: '', assigneeName: '', assigneeRank: '사원' }],
      timeline: timeline.length ? timeline : [{ time: '', topic: '', note: '' }],
      author,
      notes,
    };
  };

  const applyParsedToForm = (parsed) => {
    setFormData({
      title: parsed.title || '제목 없는 회의록',
      date: parsed.date || new Date().toISOString().split('T')[0],
      attendeesText: Array.isArray(parsed.attendees) ? parsed.attendees.join(', ') : parsed.attendees || '',
      agenda: parsed.agenda || '',
      content: parsed.content || '',
      actions:
        Array.isArray(parsed.actions) && parsed.actions.length > 0
          ? parsed.actions.map((a, i) => ({
              id: `act-${Date.now()}-${i}`,
              task: a.task || '',
              assigneeName: a.assigneeName || a.assignee || '',
              assigneeRank: RANK_OPTIONS.includes(a.assigneeRank) ? a.assigneeRank : '사원',
              done: Boolean(a.done),
            }))
          : [{ id: `act-${Date.now()}`, task: '', assigneeName: '', assigneeRank: '사원', done: false }],
      timeline:
        Array.isArray(parsed.timeline) && parsed.timeline.length > 0
          ? parsed.timeline.map((t, i) => ({
              id: `tl-${Date.now()}-${i}`,
              time: t.time || '',
              topic: t.topic || '',
              note: t.note || '',
            }))
          : [{ id: `tl-${Date.now()}`, time: '', topic: '', note: '' }],
      author: parsed.author || '',
      notes: parsed.notes || '',
      attachments: formData.attachments || [],
    });
    setCreateStep('review');
  };

  const startNewMeeting = () => {
    setFormData(emptyForm);
    setRawInput('');
    setAnalyzeError('');
    setCreateStep('input');
    setViewMode('create');
  };

  const startEditMeeting = (meeting) => {
    setFormData({
      title: meeting.title,
      date: meeting.date,
      attendeesText: (meeting.attendees || []).join(', '),
      agenda: meeting.agenda,
      content: meeting.content,
      actions:
        meeting.actions && meeting.actions.length > 0
          ? meeting.actions.map((a) => ({
              ...a,
              assigneeName: a.assigneeName || a.assignee || '',
              assigneeRank: RANK_OPTIONS.includes(a.assigneeRank) ? a.assigneeRank : '사원',
            }))
          : [{ id: `act-${Date.now()}`, task: '', assigneeName: '', assigneeRank: '사원', done: false }],
      timeline:
        meeting.timeline && meeting.timeline.length > 0
          ? meeting.timeline
          : [{ id: `tl-${Date.now()}`, time: '', topic: '', note: '' }],
      author: meeting.author,
      notes: meeting.notes,
      attachments: meeting.attachments || [],
    });
    setViewMode('edit');
  };

  const handleSaveMeeting = async () => {
    if (!formData.title.trim()) {
      alert('회의 제목을 입력해 주세요.');
      return;
    }

    setIsSaving(true);
    const cleanedAttendees = formData.attendeesText
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean);

    const cleanedActions = formData.actions.filter((a) => a.task.trim() || a.assigneeName.trim());
    const cleanedTimeline = formData.timeline.filter((t) => t.time.trim() || t.topic.trim() || t.note.trim());

    const payload = {
      title: formData.title.trim(),
      date: formData.date,
      attendees: cleanedAttendees,
      agenda: formData.agenda.trim(),
      content: formData.content.trim(),
      actions: cleanedActions,
      timeline: cleanedTimeline,
      author: formData.author.trim() || '미지정',
      notes: formData.notes.trim(),
      attachments: formData.attachments,
    };

    try {
      if (viewMode === 'edit' && selectedMeeting) {
        if (db) {
          await updateDoc(doc(db, 'meetings', selectedMeeting.id), payload);
        } else {
          setMeetings((prev) => prev.map((m) => (m.id === selectedMeeting.id ? { ...payload, id: m.id } : m)));
        }
        setSelectedId(selectedMeeting.id);
        showToast('회의록이 수정되어 모든 팀원에게 반영되었습니다.');
      } else {
        if (db) {
          const docRef = await addDoc(collection(db, 'meetings'), {
            ...payload,
            createdAt: serverTimestamp(),
          });
          setSelectedId(docRef.id);
        } else {
          const newId = `m-${Date.now()}`;
          setMeetings((prev) => [{ ...payload, id: newId }, ...prev]);
          setSelectedId(newId);
        }
        showToast('새 회의록이 저장되어 팀 보드에 공유되었습니다!');
      }
      setViewMode('list');
    } catch (e) {
      alert('저장 중 오류가 발생했습니다. 설정을 확인해 주세요.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteMeeting = async (id) => {
    if (!window.confirm('이 회의록을 삭제하시겠습니까?')) return;
    if (db) {
      await deleteDoc(doc(db, 'meetings', id));
    } else {
      const next = meetings.filter((m) => m.id !== id);
      setMeetings(next);
    }
    if (selectedId === id) {
      setSelectedId(null);
    }
    showToast('회의록이 삭제되었습니다.');
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const mapped = files.map((f) => ({
      name: f.name,
      size: `${(f.size / (1024 * 1024)).toFixed(2)} MB`,
      type: f.type || 'application/octet-stream',
    }));
    setFormData((prev) => ({
      ...prev,
      attachments: [...prev.attachments, ...mapped],
    }));
  };

  // 팀 비밀번호 잠금 화면
  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl max-w-sm w-full p-8 shadow-2xl border border-slate-200">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center mx-auto mb-4 shadow-md">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 text-center">AI 회의록 공유 허브</h1>
          <p className="text-sm text-slate-500 text-center mt-1.5">
            팀원 전용 공간입니다. 사내 접속 비밀번호를 입력해 주세요.
          </p>

          <form onSubmit={handleUnlock} className="mt-6 space-y-4">
            <div>
              <input
                type="password"
                value={passcodeInput}
                onChange={(e) => {
                  setPasscodeInput(e.target.value);
                  setPasscodeError(false);
                }}
                placeholder="접속 비밀번호 입력"
                className="w-full px-4 py-3 text-center text-lg tracking-widest rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoFocus
              />
              {passcodeError && (
                <p className="text-xs text-red-600 text-center mt-2">
                  비밀번호가 일치하지 않습니다. 다시 확인해 주세요.
                </p>
              )}
            </div>
            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition shadow-sm"
            >
              회의록 허브 입장하기
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col">
      {copiedToast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg text-sm font-medium">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{copiedToast}</span>
        </div>
      )}

      {/* 상단 내비게이션 */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  AI 회의록 자동 정리 & 공유 허브
                </h1>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                    isFirebaseConfigured
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}
                >
                  <Database className="w-3 h-3" />
                  {isFirebaseConfigured ? '실시간 DB 연동됨' : '데모 모드'}
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                회의 메모 입력 → AI 자동 구조화 · 검토 → 팀원 전체 실시간 열람
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => handleShareLink(null)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium transition"
            >
              <Share2 className="w-4 h-4 text-indigo-600" />
              <span>링크 공유하기</span>
            </button>
            <button
              onClick={startNewMeeting}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>새 회의록 입력</span>
            </button>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 영역 */}
      {viewMode === 'list' ? (
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* 좌측: 통합 회의록 리스트 & 필터 */}
          <section className="lg:col-span-4 flex flex-col gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="제목, 안건, 담당자, 직급, 특이사항 검색..."
                  className="w-full pl-10 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
                />
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <button
                  onClick={() => setFilterAttendee('ALL')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                    filterAttendee === 'ALL'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  전체 ({meetings.length})
                </button>
                {allAttendees.map((person) => (
                  <button
                    key={person}
                    onClick={() => setFilterAttendee(person)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                      filterAttendee === person
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {person}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2.5 overflow-y-auto max-h-[calc(100vh-240px)] pr-1">
              {isLoadingDb ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>회의록 불러오는 중...</span>
                </div>
              ) : filteredMeetings.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 text-sm">
                  조건에 맞는 회의록이 없습니다.
                </div>
              ) : (
                filteredMeetings.map((m) => {
                  const isSelected = m.id === selectedId;
                  const doneCount = (m.actions || []).filter((a) => a.done).length;
                  const totalActions = (m.actions || []).length;

                  return (
                    <div
                      key={m.id}
                      onClick={() => setSelectedId(m.id)}
                      className={`p-4 rounded-2xl border cursor-pointer transition ${
                        isSelected
                          ? 'bg-indigo-50/70 border-indigo-400 shadow-sm'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                        <span className="inline-flex items-center gap-1 font-medium text-indigo-600">
                          <Calendar className="w-3.5 h-3.5" />
                          {m.date}
                        </span>
                        <span>작성: {m.author}</span>
                      </div>
                      <h3 className="font-bold text-slate-900 text-sm line-clamp-1 mb-2">{m.title}</h3>
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span className="truncate max-w-[180px]">
                          참석 {(m.attendees || []).length}명 ({(m.attendees || []).slice(0, 2).join(', ')}
                          {(m.attendees || []).length > 2 ? ' 외' : ''})
                        </span>
                        {totalActions > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">
                            <CheckSquare className="w-3 h-3 text-emerald-600" />
                            {doneCount}/{totalActions}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* 우측: 선택된 회의록 상세 보기 */}
          <section className="lg:col-span-8">
            {selectedMeeting ? (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{selectedMeeting.date}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleShareLink(selectedMeeting.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 transition"
                      >
                        <Share2 className="w-3.5 h-3.5 text-indigo-600" />
                        이 회의록 링크 복사
                      </button>
                      <button
                        onClick={() => startEditMeeting(selectedMeeting)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 transition"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        수정
                      </button>
                      <button
                        onClick={() => handleDeleteMeeting(selectedMeeting.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-100 hover:bg-red-50 text-xs font-medium text-red-600 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        삭제
                      </button>
                    </div>
                  </div>

                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-4">
                    {selectedMeeting.title}
                  </h2>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div className="flex items-start gap-2 bg-slate-50 p-3 rounded-xl">
                      <Users className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                      <div>
                        <span className="text-xs text-slate-400 block">참석자</span>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {(selectedMeeting.attendees || []).map((person, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-700"
                            >
                              {person}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-2 bg-slate-50 p-3 rounded-xl">
                      <User className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                      <div>
                        <span className="text-xs text-slate-400 block">작성자</span>
                        <span className="font-semibold text-slate-800 mt-0.5 block">
                          {selectedMeeting.author}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-2.5">
                      <ListChecks className="w-4 h-4 text-indigo-600" />
                      주요 안건
                    </h3>
                    <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-700 whitespace-pre-line leading-relaxed border border-slate-100">
                      {selectedMeeting.agenda || '등록된 안건이 없습니다.'}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-2.5">
                      <Clock className="w-4 h-4 text-indigo-600" />
                      안건 타임라인
                    </h3>
                    {selectedMeeting.timeline && selectedMeeting.timeline.length > 0 ? (
                      <div className="relative pl-4 border-l-2 border-indigo-200 space-y-4">
                        {selectedMeeting.timeline.map((item) => (
                          <div key={item.id} className="relative">
                            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 absolute -left-[21px] top-1.5 ring-4 ring-white" />
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                                {item.time || '시간 미정'}
                              </span>
                              <span className="text-sm font-bold text-slate-900">{item.topic}</span>
                            </div>
                            {item.note && <p className="text-xs text-slate-600 mt-1">{item.note}</p>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400">타임라인 정보가 없습니다.</p>
                    )}
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-2.5">
                      <FileText className="w-4 h-4 text-indigo-600" />
                      회의 상세 내용
                    </h3>
                    <div className="text-sm text-slate-700 whitespace-pre-line leading-relaxed bg-white border border-slate-200 rounded-xl p-4">
                      {selectedMeeting.content || '상세 내용이 없습니다.'}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <CheckSquare className="w-4 h-4 text-emerald-600" />
                        액션 아이템 (할일 & 담당자)
                      </h3>
                      <span className="text-xs text-slate-400">클릭하여 완료 상태 변경</span>
                    </div>
                    {selectedMeeting.actions && selectedMeeting.actions.length > 0 ? (
                      <div className="space-y-2">
                        {selectedMeeting.actions.map((act) => (
                          <div
                            key={act.id}
                            onClick={() => toggleActionDone(selectedMeeting.id, act.id)}
                            className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
                              act.done
                                ? 'bg-emerald-50/50 border-emerald-200 text-slate-400'
                                : 'bg-white border-slate-200 hover:border-indigo-300'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              {act.done ? (
                                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                              ) : (
                                <Circle className="w-5 h-5 text-slate-300 shrink-0" />
                              )}
                              <span className={`text-sm font-medium ${act.done ? 'line-through' : 'text-slate-800'}`}>
                                {act.task}
                              </span>
                            </div>
                            {(act.assigneeName || act.assigneeRank) && (
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 shrink-0 ml-2">
                                <span>{act.assigneeName || '담당자 미지정'}</span>
                                {act.assigneeRank && (
                                  <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 text-[11px]">
                                    {act.assigneeRank}
                                  </span>
                                )}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400">등록된 액션 아이템이 없습니다.</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-4">
                      <h4 className="text-xs font-bold text-amber-900 flex items-center gap-1.5 mb-2">
                        <AlertCircle className="w-4 h-4 text-amber-600" />
                        특이사항
                      </h4>
                      <p className="text-sm text-amber-950 whitespace-pre-line">
                        {selectedMeeting.notes || '특이사항 없음'}
                      </p>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                      <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-2">
                        <Paperclip className="w-4 h-4 text-slate-600" />
                        첨부 파일 ({(selectedMeeting.attachments || []).length})
                      </h4>
                      {selectedMeeting.attachments && selectedMeeting.attachments.length > 0 ? (
                        <ul className="space-y-1.5">
                          {selectedMeeting.attachments.map((file, i) => (
                            <li
                              key={i}
                              className="flex items-center justify-between text-xs bg-white px-3 py-2 rounded-lg border border-slate-200"
                            >
                              <span className="flex items-center gap-1.5 font-medium text-slate-700 truncate">
                                <File className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                {file.name}
                              </span>
                              <span className="text-slate-400 shrink-0 ml-2">{file.size}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-slate-400">첨부된 파일이 없습니다.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
                좌측 목록에서 회의록을 선택하거나 우측 상단에서 새 회의록을 입력해 주세요.
              </div>
            )}
          </section>
        </main>
      ) : (
        /* 새 회의록 입력 및 AI 자동 분류 확인/수정 화면 */
        <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6">
          <div className="mb-5 flex items-center justify-between">
            <button
              onClick={() => setViewMode('list')}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="w-4 h-4" />
              목록으로 돌아가기
            </button>

            {viewMode === 'create' && (
              <div className="flex items-center gap-2 text-xs font-semibold">
                <span
                  className={`px-3 py-1 rounded-full ${
                    createStep === 'input' ? 'bg-indigo-600 text-white' : 'bg-indigo-100 text-indigo-700'
                  }`}
                >
                  1. 원본 메모 입력
                </span>
                <span className="text-slate-300">→</span>
                <span
                  className={`px-3 py-1 rounded-full ${
                    createStep === 'review' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  2. AI 분류 확인 및 수정
                </span>
              </div>
            )}
          </div>

          {viewMode === 'create' && createStep === 'input' ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-indigo-600" />
                    회의 메모를 붙여넣으세요
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    형식에 맞추지 않고 자유롭게 적은 메모나 녹취록을 넣으면 AI가 9가지 항목으로 자동 분류합니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRawInput(SAMPLE_RAW_NOTES)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                >
                  샘플 회의록 채우기
                </button>
              </div>

              <textarea
                rows={12}
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
                placeholder="예: 2026년 11월 26일 주간회의 / 참석: 김팀장, 이대리 / 안건: 신규 런칭 일정 / 논의내용... / 액션: 박지훈 대리 금요일까지 테스트 완료..."
                className="w-full p-4 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white leading-relaxed"
              />

              {analyzeError && <p className="text-sm text-red-600 font-medium">{analyzeError}</p>}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateStep('review')}
                  className="text-sm font-medium text-slate-500 hover:text-slate-800 underline"
                >
                  AI 분류 건너뛰고 직접 양식 작성하기
                </button>

                <button
                  type="button"
                  onClick={handleAnalyzeWithAI}
                  disabled={isAnalyzing}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-bold shadow-sm transition"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      AI가 항목별로 자동 분류하는 중...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      AI 자동 분류 및 정리하기
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* 2단계: 확인 및 수정 폼 */
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <span className="inline-block text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md mb-1">
                    저장 전 확인 단계
                  </span>
                  <h2 className="text-lg font-bold text-slate-900">
                    분류된 내용을 확인하고 필요한 부분을 수정해 주세요
                  </h2>
                </div>
                {viewMode === 'create' && (
                  <button
                    type="button"
                    onClick={() => setCreateStep('input')}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
                  >
                    ← 원문 다시 입력하기
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">회의 제목 *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="예: 11월 4주차 제품 런칭 주간 회의"
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">회의 날짜</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    참석자 (쉼표로 구분)
                  </label>
                  <input
                    type="text"
                    value={formData.attendeesText}
                    onChange={(e) => setFormData({ ...formData, attendeesText: e.target.value })}
                    placeholder="김민수 팀장, 이서연 PM, 박지훈 개발자"
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">작성자</label>
                  <input
                    type="text"
                    value={formData.author}
                    onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                    placeholder="작성자 이름"
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">주요 안건</label>
                <textarea
                  rows={3}
                  value={formData.agenda}
                  onChange={(e) => setFormData({ ...formData, agenda: e.target.value })}
                  placeholder="1. 첫 번째 안건&#10;2. 두 번째 안건"
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">안건 타임라인</label>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        timeline: [...formData.timeline, { id: `tl-${Date.now()}`, time: '', topic: '', note: '' }],
                      })
                    }
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                  >
                    + 타임라인 추가
                  </button>
                </div>
                <div className="space-y-2">
                  {formData.timeline.map((item, idx) => (
                    <div key={item.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                      <input
                        type="text"
                        value={item.time}
                        onChange={(e) => {
                          const next = [...formData.timeline];
                          next[idx].time = e.target.value;
                          setFormData({ ...formData, timeline: next });
                        }}
                        placeholder="10:00 - 10:20"
                        className="sm:col-span-3 px-3 py-2 text-xs border border-slate-200 rounded-lg"
                      />
                      <input
                        type="text"
                        value={item.topic}
                        onChange={(e) => {
                          const next = [...formData.timeline];
                          next[idx].topic = e.target.value;
                          setFormData({ ...formData, timeline: next });
                        }}
                        placeholder="안건 주제"
                        className="sm:col-span-4 px-3 py-2 text-xs border border-slate-200 rounded-lg"
                      />
                      <input
                        type="text"
                        value={item.note}
                        onChange={(e) => {
                          const next = [...formData.timeline];
                          next[idx].note = e.target.value;
                          setFormData({ ...formData, timeline: next });
                        }}
                        placeholder="세부 내용 요약"
                        className="sm:col-span-4 px-3 py-2 text-xs border border-slate-200 rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setFormData({
                            ...formData,
                            timeline: formData.timeline.filter((_, i) => i !== idx),
                          })
                        }
                        className="sm:col-span-1 text-slate-400 hover:text-red-500 flex justify-center"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">회의 상세 내용</label>
                <textarea
                  rows={5}
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="회의에서 논의된 핵심 내용과 결정 사항을 정리합니다."
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* 액션 아이템 (할일 / 이름 / 직급 드롭다운) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    액션 아이템 (할일 · 이름 · 직급)
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        actions: [
                          ...formData.actions,
                          { id: `act-${Date.now()}`, task: '', assigneeName: '', assigneeRank: '사원', done: false },
                        ],
                      })
                    }
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                  >
                    + 액션 추가
                  </button>
                </div>
                <div className="space-y-2">
                  {formData.actions.map((act, idx) => (
                    <div key={act.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                      <input
                        type="text"
                        value={act.task}
                        onChange={(e) => {
                          const next = [...formData.actions];
                          next[idx].task = e.target.value;
                          setFormData({ ...formData, actions: next });
                        }}
                        placeholder="할일 내용 입력"
                        className="sm:col-span-7 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <input
                        type="text"
                        value={act.assigneeName}
                        onChange={(e) => {
                          const next = [...formData.actions];
                          next[idx].assigneeName = e.target.value;
                          setFormData({ ...formData, actions: next });
                        }}
                        placeholder="이름"
                        className="sm:col-span-2 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <select
                        value={act.assigneeRank}
                        onChange={(e) => {
                          const next = [...formData.actions];
                          next[idx].assigneeRank = e.target.value;
                          setFormData({ ...formData, actions: next });
                        }}
                        aria-label="직급 선택"
                        className="sm:col-span-2 px-2.5 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {RANK_OPTIONS.map((rank) => (
                          <option key={rank} value={rank}>
                            {rank}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() =>
                          setFormData({
                            ...formData,
                            actions: formData.actions.filter((_, i) => i !== idx),
                          })
                        }
                        className="sm:col-span-1 text-slate-400 hover:text-red-500 flex justify-center"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">특이사항</label>
                  <textarea
                    rows={3}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="이슈, 리스크, 추후 참고사항"
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">파일 첨부</label>
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl p-4 cursor-pointer bg-slate-50/50 transition">
                    <Upload className="w-5 h-5 text-indigo-600 mb-1" />
                    <span className="text-xs font-medium text-slate-600">클릭하여 참고 자료 첨부</span>
                    <input type="file" multiple onChange={handleFileUpload} className="hidden" />
                  </label>
                  {formData.attachments.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {formData.attachments.map((file, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between text-xs bg-slate-100 px-2.5 py-1.5 rounded-lg"
                        >
                          <span className="truncate">{file.name}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setFormData({
                                ...formData,
                                attachments: formData.attachments.filter((_, idx) => idx !== i),
                              })
                            }
                            className="text-slate-400 hover:text-red-500 ml-2"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleSaveMeeting}
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-bold shadow-sm transition"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? '저장 중...' : '최종 확인 및 팀 보드에 저장'}
                </button>
              </div>
            </div>
          )}
        </main>
      )}
    </div>
  );
}