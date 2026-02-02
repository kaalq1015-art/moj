import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, FileText, UserCheck, ShieldCheck, Clock, AlertCircle, 
  CheckCircle2, Trash2, Loader2, Users, Calendar, Play, X, 
  FileSearch, ChevronLeft, Info, ArrowDownWideNarrow
} from 'lucide-react';

// الإعدادات الخاصة بك (Gemini 2.0 Flash)
const API_KEY = "AIzaSyB051BQjnc-35XdnawKElWDyNxOBYNL9WE";
const MODEL_NAME = "gemini-2.0-flash";

const App = () => {
  const [documents, setDocuments] = useState([]); 
  const [pendingFiles, setPendingFiles] = useState([]); 
  const [analysisResults, setAnalysisResults] = useState([]); 
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (documents.length > 0) processSuccessionLogic();
  }, [documents]);

  const processSuccessionLogic = () => {
    const sortedDocs = [...documents].sort((a, b) => new Date(a.issueDate) - new Date(b.issueDate));
    const hosrDocs = sortedDocs.filter(d => d.docType === 'HOSR');
    if (hosrDocs.length === 0) return;

    const mainDeceasedName = hosrDocs[0].deceasedName;
    const poaDocs = sortedDocs.filter(d => d.docType === 'POA');

    let heirsSummary = [];

    hosrDocs.forEach(doc => {
      const isMainDeceased = doc.deceasedName === mainDeceasedName;
      doc.heirs.forEach(heir => {
        const foundPoa = poaDocs.find(p => 
          p.principals.some(principal => 
            principal.trim().includes(heir.name.trim()) || heir.name.trim().includes(principal.trim())
          )
        );

        const isAgent = poaDocs.some(p => 
          p.agentName.trim().includes(heir.name.trim()) || heir.name.trim().includes(p.agentName.trim())
        );

        let reqText = isMainDeceased 
          ? `يجب أن تكون الوكالة خاصة بالإرث العائد من المورث (${mainDeceasedName})`
          : `يجب أن تكون الوكالة خاصة بالإرث العائد من (${doc.deceasedName})، والعائد له من (${mainDeceasedName})، وفيما توارثوه بينهم`;

        heirsSummary.push({
          id: Math.random(),
          name: heir.name,
          relation: heir.relation,
          idNo: heir.idNo,
          deceasedName: doc.deceasedName,
          isMain: isMainDeceased,
          isAuthorized: !!foundPoa,
          isAgent: isAgent,
          agentName: isAgent ? "نفسه (وكيل)" : (foundPoa ? foundPoa.agentName : "-"),
          instruction: reqText
        });
      });
    });
    setAnalysisResults(heirsSummary);
  };

  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
  });

  const processWithGemini = async (base64, mimeType) => {
    const systemPrompt = `Analyze the Saudi legal document and extract:
      - docType: "HOSR" or "POA".
      - issueDate: (YYYY-MM-DD).
      - deceasedName: (for HOSR).
      - heirs: Array of {name, relation, idNo} (for HOSR).
      - agentName: (for POA).
      - principals: Array of names (for POA).
      Return ONLY clean JSON.`;

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Extract JSON data:" }, { inlineData: { mimeType, data: base64 } }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { responseMimeType: "application/json" }
        })
      });
      const data = await response.json();
      return JSON.parse(data.candidates[0].content.parts[0].text);
    } catch (err) { throw err; }
  };

  const startAnalysis = async () => {
    setIsProcessing(true);
    setProgress({ current: 0, total: pendingFiles.length });
    for (let i = 0; i < pendingFiles.length; i++) {
      try {
        const base64 = await fileToBase64(pendingFiles[i].file);
        const result = await processWithGemini(base64, pendingFiles[i].file.type);
        setDocuments(prev => [...prev, { ...result, id: Math.random(), fileName: pendingFiles[i].name }]);
      } catch (err) { setError(`خطأ في ملف: ${pendingFiles[i].name}`); }
      setProgress(prev => ({ ...prev, current: i + 1 }));
    }
    setPendingFiles([]);
    setIsProcessing(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-right p-4 md:p-8 font-sans" dir="rtl">
      <header className="max-w-7xl mx-auto mb-8 bg-white p-6 rounded-3xl shadow-sm border flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="bg-emerald-600 p-3 rounded-2xl text-white shadow-lg"><ShieldCheck size={28} /></div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">منصة تدقيق عمليات الورثة</h1>
            <p className="text-slate-500 text-xs">تحليل التناسخ والوكالات آلياً (Gemini 2.0)</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => fileInputRef.current.click()} className="bg-slate-100 px-6 py-3 rounded-xl font-bold flex gap-2 border hover:bg-slate-200 transition-all"><Upload size={18} /> إرفاق</button>
          {pendingFiles.length > 0 && (
            <button onClick={startAnalysis} disabled={isProcessing} className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold flex gap-2 shadow-lg hover:bg-emerald-700 transition-all">
              {isProcessing ? <Loader2 className="animate-spin" /> : <Play size={18} fill="currentColor" />}
              تحليل ({pendingFiles.length})
            </button>
          )}
          <input type="file" ref={fileInputRef} onChange={(e) => setPendingFiles(Array.from(e.target.files).map(f => ({file: f, name: f.name})))} className="hidden" multiple accept="application/pdf,image/*" />
        </div>
      </header>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white p-5 rounded-3xl shadow-sm border">
            <h2 className="font-bold text-slate-800 mb-4 flex gap-2 border-b pb-2"><Clock size={18} /> الترتيب الزمني</h2>
            {documents.length === 0 ? <p className="text-slate-300 text-xs text-center py-4 italic">لا توجد ملفات</p> : (
              <div className="space-y-3 relative before:absolute before:right-2 before:top-0 before:bottom-0 before:w-0.5 before:bg-slate-50">
                {documents.sort((a,b) => new Date(a.issueDate) - new Date(b.issueDate)).map(doc => (
                  <div key={doc.id} className="relative pr-6">
                    <div className="absolute right-0 top-2 w-2 h-2 rounded-full bg-emerald-500 border-2 border-white"></div>
                    <div className="bg-slate-50 p-3 rounded-xl border">
                      <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-tighter">{doc.docType === 'HOSR' ? 'حصر' : 'وكالة'}</div>
                      <div className="text-[11px] font-bold text-slate-800 truncate">{doc.fileName}</div>
                      <div className="text-[9px] text-slate-400 mt-1">{doc.issueDate}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-9 bg-white rounded-3xl shadow-sm border overflow-hidden">
          <div className="p-6 border-b flex justify-between bg-white">
            <h2 className="font-bold text-slate-800 flex gap-2"><Users className="text-emerald-600" /> تحليل حالة الورثة</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase tracking-widest">
                  <th className="p-4 border-b">المتوفى</th>
                  <th className="p-4 border-b">الوارث</th>
                  <th className="p-4 border-b text-center">التوكيل</th>
                  <th className="p-4 border-b">الوكيل</th>
                  <th className="p-4 border-b">المطلوب</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {analysisResults.map((heir, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${heir.isMain ? 'bg-amber-50 text-amber-600 border' : 'bg-indigo-50 text-indigo-600 border'}`}>{heir.deceasedName}</span>
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-slate-800 text-sm">{heir.name}</div>
                      <div className="text-[10px] text-slate-400 mt-1">{heir.relation} - {heir.idNo}</div>
                    </td>
                    <td className="p-4 text-center">
                      <div className={`w-8 h-8 rounded-xl mx-auto flex items-center justify-center ${heir.isAuthorized ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-500'}`}>
                        {heir.isAuthorized ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm font-bold text-slate-700">{heir.agentName}</div>
                      {heir.isAgent && <div className="mt-1 text-[9px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-100">المفترض يكون حاضر</div>}
                    </td>
                    <td className="p-4 max-w-[200px] text-[10px] text-slate-500 italic leading-relaxed">{heir.instruction}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;

