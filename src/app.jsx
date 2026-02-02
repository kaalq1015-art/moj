import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, FileText, UserCheck, ShieldCheck, Clock, AlertCircle, 
  CheckCircle2, Trash2, Loader2, Users, Calendar, Play, X, 
  FileSearch, ChevronLeft, Info
} from 'lucide-react';

// استخدام الـ Key والموديل الذي زودتني بهما
const API_KEY = "AIzaSyB051BQjnc-35XdnawKElWDyNxOBYNL9WE";
const MODEL_NAME = "gemini-2.0-flash";

const App = () => {
  const [documents, setDocuments] = useState([]);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [heirsResults, setHeirsResults] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (documents.length > 0) processInheritance();
  }, [documents]);

  const processInheritance = () => {
    const sorted = [...documents].sort((a, b) => new Date(a.issueDate) - new Date(b.issueDate));
    const hosrDocs = sorted.filter(d => d.docType === 'HOSR');
    if (hosrDocs.length === 0) return;

    const mainDeceased = hosrDocs[0].deceasedName;
    const poas = sorted.filter(d => d.docType === 'POA');

    let summary = [];
    hosrDocs.forEach(doc => {
      const isMain = doc.deceasedName === mainDeceased;
      doc.heirs.forEach(heir => {
        const poaFound = poas.find(p => p.principals.some(pr => pr.trim().includes(heir.name.trim()) || heir.name.trim().includes(pr.trim())));
        const isAgent = poas.some(p => p.agentName.trim().includes(heir.name.trim()) || heir.name.trim().includes(p.agentName.trim()));
        
        // النص القانوني المطلوب (أ) و (ب)
        let reqText = isMain 
          ? `الوكالة يجب أن تكون خاصة بالإرث العائد من (${mainDeceased})`
          : `الوكالة يجب أن تكون خاصة بالإرث العائد من (${doc.deceasedName})، والعائد له من (${mainDeceased})، وفيما توارثوه بينهم`;

        summary.push({
          name: heir.name,
          deceased: doc.deceasedName,
          isMain,
          isAuthorized: !!poaFound,
          isAgent,
          agentName: isAgent ? "نفسه (وكيل)" : (poaFound ? poaFound.agentName : "-"),
          note: reqText,
          idNo: heir.idNo
        });
      });
    });
    setHeirsResults(summary);
  };

  const startAnalysis = async () => {
    setIsProcessing(true);
    for (const f of pendingFiles) {
      try {
        const reader = new FileReader();
        const b64 = await new Promise(res => {
          reader.readAsDataURL(f.file);
          reader.onload = () => res(reader.result.split(',')[1]);
        });
        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: "Extract JSON: docType(HOSR/POA), issueDate(YYYY-MM-DD), deceasedName, heirs[{name, relation, idNo}], agentName, principals[]" }, { inlineData: { mimeType: f.file.type, data: b64 } }] }],
            generationConfig: { responseMimeType: "application/json" }
          })
        });
        const data = await response.json();
        const result = JSON.parse(data.candidates[0].content.parts[0].text);
        setDocuments(prev => [...prev, { ...result, fileName: f.name, id: Math.random() }]);
      } catch (e) { console.error(e); }
    }
    setPendingFiles([]);
    setIsProcessing(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-right p-4 md:p-8" dir="rtl">
      <div className="max-w-7xl mx-auto mb-8 bg-white p-6 rounded-[2rem] shadow-sm border flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="bg-slate-900 p-4 rounded-2xl text-white shadow-lg"><ShieldCheck size={32} /></div>
          <div>
            <h1 className="text-2xl font-black text-slate-800">منظومة منفذ الورثة</h1>
            <p className="text-slate-500 text-xs">تحليل ذكي للتناسخ والوكالات</p>
          </div>
        </div>
        <div className="flex gap-4">
          <button onClick={() => fileInputRef.current.click()} className="bg-slate-100 px-6 py-4 rounded-2xl font-bold flex gap-2"><Upload size={20} /> إرفاق</button>
          {pendingFiles.length > 0 && <button onClick={startAnalysis} className="bg-indigo-600 text-white px-10 py-4 rounded-2xl font-black flex gap-2 shadow-xl">{isProcessing ? <Loader2 className="animate-spin" /> : <Play size={20} fill="currentColor" />} معالجة ({pendingFiles.length})</button>}
          <input type="file" ref={fileInputRef} onChange={(e) => setPendingFiles(Array.from(e.target.files).map(f => ({file: f, name: f.name})))} className="hidden" multiple accept="application/pdf,image/*" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-3 bg-white p-6 rounded-[2rem] shadow-sm border h-fit">
          <h2 className="text-lg font-bold mb-6 flex gap-2 border-b pb-4"><Clock className="text-indigo-600" size={20} /> تسلسل الصكوك</h2>
          <div className="space-y-4">
            {documents.sort((a,b) => new Date(a.issueDate) - new Date(b.issueDate)).map(doc => (
              <div key={doc.id} className="bg-slate-50 p-4 rounded-2xl border">
                <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">{doc.docType === 'HOSR' ? 'حصر' : 'وكالة'}</span>
                <div className="font-bold text-xs mt-2 truncate">{doc.fileName}</div>
                <div className="text-[9px] text-slate-400 mt-1 italic">{doc.issueDate}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-9 bg-white rounded-[2rem] shadow-sm border overflow-hidden">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-[11px] font-black uppercase tracking-widest border-b">
                <th className="p-5">المتوفى</th>
                <th className="p-5">الوارث</th>
                <th className="p-5 text-center">الحالة</th>
                <th className="p-5">الوكيل</th>
                <th className="p-5">النص المطلوب</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {heirsResults.map((h, i) => (
                <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-5"><span className={`text-[10px] font-bold px-3 py-1.5 rounded-xl border ${h.isMain ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>{h.deceased}</span></td>
                  <td className="p-5"><div className="font-bold text-sm">{h.name}</div><div className="text-[10px] text-slate-400 font-mono">{h.idNo}</div></td>
                  <td className="p-5 text-center">
                    <div className={`w-10 h-10 rounded-2xl mx-auto flex items-center justify-center ${h.isAuthorized ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-500'}`}>
                      {h.isAuthorized ? <CheckCircle2 size={22} /> : <AlertCircle size={22} />}
                    </div>
                  </td>
                  <td className="p-5"><div className="text-sm font-bold text-slate-700">{h.agentName}</div>{h.isAgent && <div className="mt-2 text-[10px] font-black text-orange-600 bg-orange-50 px-2 py-1 rounded-lg border border-orange-100">المفترض يكون حاضر</div>}</td>
                  <td className="p-5 text-[10px] text-slate-500 leading-relaxed max-w-[250px]">{h.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default App;
