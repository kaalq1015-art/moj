import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, FileText, UserCheck, ShieldCheck, Clock, AlertCircle, 
  CheckCircle2, Trash2, Loader2, Users, Calendar, Play, X, 
  FileSearch, ChevronLeft, Info, History
} from 'lucide-react';

// إعدادات الـ API والموديل المطلوب
const API_KEY = "AIzaSyB051BQjnc-35XdnawKElWDyNxOBYNL9WE";
const MODEL_NAME = "gemini-2.0-flash";

const App = () => {
  const [documents, setDocuments] = useState([]);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [heirsResults, setHeirsResults] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const fileInputRef = useRef(null);

  // تحديث التحليل القانوني فور تغير المستندات
  useEffect(() => {
    if (documents.length > 0) {
      calculateInheritanceLogic();
    }
  }, [documents]);

  const calculateInheritanceLogic = () => {
    // ترتيب المستندات حسب التاريخ
    const sortedDocs = [...documents].sort((a, b) => new Date(a.issueDate) - new Date(b.issueDate));
    
    // المورث الأساسي (المتوفى أ) هو صاحب أول صك حصر ورثة
    const hosrDocs = sortedDocs.filter(d => d.docType === 'HOSR');
    if (hosrDocs.length === 0) return;

    const mainDeceasedName = hosrDocs[0].deceasedName;
    const poaDocs = sortedDocs.filter(d => d.docType === 'POA');

    let allHeirs = [];

    hosrDocs.forEach(doc => {
      const isMainDeceased = doc.deceasedName === mainDeceasedName;
      
      doc.heirs.forEach(heir => {
        // فحص حالة التوكيل
        const matchingPoa = poaDocs.find(p => 
          p.principals.some(principal => 
            principal.trim().includes(heir.name.trim()) || heir.name.trim().includes(principal.trim())
          )
        );

        // فحص هل هو وكيل
        const isAgent = poaDocs.some(p => 
          p.agentName.trim().includes(heir.name.trim()) || heir.name.trim().includes(p.agentName.trim())
        );

        // النص القانوني التلقائي
        let instruction = "";
        if (isMainDeceased) {
          instruction = `يجب أن تكون الوكالة خاصة بالإرث العائد من المورث (${mainDeceasedName})`;
        } else {
          instruction = `يجب أن تكون الوكالة خاصة بالإرث العائد من المورث (${doc.deceasedName})، والعائد له من المورث (${mainDeceasedName})، وفيما توارثوه بينهم`;
        }

        allHeirs.push({
          id: Math.random(),
          name: heir.name,
          relation: heir.relation,
          idNo: heir.idNo,
          deceasedName: doc.deceasedName,
          isMainDeceased,
          isAuthorized: !!matchingPoa,
          isAgent: isAgent,
          agentName: isAgent ? "نفسه (وكيل)" : (matchingPoa ? matchingPoa.agentName : "-"),
          instruction: instruction
        });
      });
    });

    setHeirsResults(allHeirs);
  };

  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
  });

  const processWithGemini = async (base64, mimeType) => {
    const systemPrompt = `Extract data from Saudi legal document as JSON: 
    - docType: "HOSR" (Inheritance) or "POA" (Proxy).
    - issueDate: (YYYY-MM-DD).
    - If HOSR: deceasedName, heirs [{name, relation, idNo}].
    - If POA: agentName, principals [names].
    Only return valid JSON.`;

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Analysis request:" }, { inlineData: { mimeType, data: base64 } }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { responseMimeType: "application/json" }
        })
      });

      const data = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
      return JSON.parse(content);
    } catch (err) {
      throw err;
    }
  };

  const startProcessing = async () => {
    setIsProcessing(true);
    setErrorMessage("");

    for (const item of pendingFiles) {
      try {
        const base64 = await fileToBase64(item.file);
        const result = await processWithGemini(base64, item.file.type);
        if (result) {
          setDocuments(prev => [...prev, { ...result, id: item.id, fileName: item.name }]);
        }
      } catch (err) {
        setErrorMessage(`فشلت معالجة ملف: ${item.name}`);
      }
    }

    setPendingFiles([]);
    setIsProcessing(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-right p-4 md:p-8" dir="rtl">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="bg-slate-900 p-4 rounded-2xl text-white shadow-lg"><ShieldCheck size={32} /></div>
          <div>
            <h1 className="text-2xl font-black text-slate-800">منظومة منفذ عمليات الورثة</h1>
            <p className="text-slate-500 text-sm">أتمتة التناسخ العقاري والوكالات</p>
          </div>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto">
          <button onClick={() => fileInputRef.current.click()} className="flex-1 md:flex-none bg-slate-100 hover:bg-slate-200 text-slate-700 px-8 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all">
            <Upload size={20} /> إرفاق ملفات
          </button>
          
          {pendingFiles.length > 0 && (
            <button onClick={startProcessing} disabled={isProcessing} className="flex-1 md:flex-none bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-4 rounded-2xl font-black flex items-center justify-center gap-3 shadow-xl">
              {isProcessing ? <Loader2 className="animate-spin" /> : <Play size={20} fill="currentColor" />} معالجة ({pendingFiles.length})
            </button>
          )}
          <input type="file" ref={fileInputRef} onChange={(e) => setPendingFiles(Array.from(e.target.files).map(f => ({file: f, id: Math.random(), name: f.name})))} className="hidden" multiple accept="application/pdf,image/*" />
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm border h-fit">
            <h2 className="text-lg font-bold mb-6 flex gap-2 border-b pb-4"><History className="text-indigo-600" size={20} /> ترتيب الصكوك</h2>
            <div className="space-y-4">
              {documents.sort((a,b) => new Date(a.issueDate) - new Date(b.issueDate)).map(doc => (
                <div key={doc.id} className="bg-slate-50 p-4 rounded-2xl border">
                  <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md uppercase tracking-tighter">{doc.docType === 'HOSR' ? 'حصر ورثة' : 'وكالة'}</span>
                  <div className="font-bold text-xs mt-2 truncate">{doc.fileName}</div>
                  <div className="text-[9px] text-slate-400 mt-1">{doc.issueDate}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-9 bg-white rounded-3xl shadow-sm border overflow-hidden">
          <table className="w-full text-right border-collapse">
            <thead className="bg-slate-50 text-slate-500 text-[11px] font-black uppercase tracking-widest">
              <tr>
                <th className="p-4 border-b">المتوفى</th>
                <th className="p-4 border-b">الوارث</th>
                <th className="p-4 border-b text-center">الحالة</th>
                <th className="p-4 border-b">الوكيل</th>
                <th className="p-4 border-b">المطلوب في الوكالة</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {heirsResults.map((heir, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 transition-all group">
                  <td className="p-4"><span className={`text-[10px] font-bold px-3 py-1.5 rounded-xl ${heir.isMainDeceased ? 'bg-amber-100 text-amber-700 border' : 'bg-indigo-100 text-indigo-700 border'}`}>{heir.deceasedName}</span></td>
                  <td className="p-4"><div className="font-bold text-sm">{heir.name}</div><div className="text-[10px] text-slate-400 mt-1">{heir.relation} - {heir.idNo}</div></td>
                  <td className="p-4 text-center">
                    <div className={`w-10 h-10 rounded-2xl mx-auto flex items-center justify-center shadow-sm ${heir.isAuthorized ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-500'}`}>
                      {heir.isAuthorized ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                    </div>
                  </td>
                  <td className="p-4"><div className="text-sm font-bold text-slate-700">{heir.agentName}</div>{heir.isAgent && <div className="mt-2 text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded border border-orange-100">المفترض يكون حاضر</div>}</td>
                  <td className="p-4 text-[10px] text-slate-500 italic leading-relaxed max-w-[250px]">{heir.instruction}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {heirsResults.length === 0 && !isProcessing && <div className="py-32 text-center text-slate-300 italic">ارفع صكوك الحصر والوكالات للبدء</div>}
        </div>
      </div>
    </div>
  );
};

export default App;
