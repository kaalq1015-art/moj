import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, 
  FileText, 
  UserCheck, 
  ShieldCheck, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  Trash2, 
  Loader2,
  Users,
  Calendar,
  Play,
  X,
  FileSearch,
  ChevronLeft,
  Info
} from 'lucide-react';

/**
 * إعدادات النظام
 * ملاحظة أمنية: المفتاح مدمج هنا ليعمل معك فوراً، 
 * ولكن في GitHub يفضل استخدام import.meta.env.VITE_GEMINI_API_KEY
 */
const API_KEY = "AIzaSyB051BQjnc-35XdnawKElWDyNxOBYNL9WE"; 

const App = () => {
  const [processedDocs, setProcessedDocs] = useState([]);
  const [pendingQueue, setPendingQueue] = useState([]);
  const [analysisResult, setAnalysisResult] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState(null);
  
  const fileInputRef = useRef(null);

  // تشغيل المنطق القانوني عند تحديث المستندات المعالجة
  useEffect(() => {
    if (processedDocs.length > 0) {
      runLegalAnalysis();
    }
  }, [processedDocs]);

  const runLegalAnalysis = () => {
    // ترتيب المستندات حسب التاريخ
    const sortedDocs = [...processedDocs].sort((a, b) => new Date(a.issueDate) - new Date(b.issueDate));
    
    // المورث الأساسي (أ) هو صاحب أول صك حصر
    const hosrDocs = sortedDocs.filter(d => d.docType === 'HOSR');
    if (hosrDocs.length === 0) return;

    const mainDeceasedName = hosrDocs[0].deceasedName;
    const poaDocs = sortedDocs.filter(d => d.docType === 'POA');

    let heirsSummary = [];

    hosrDocs.forEach(doc => {
      const isMainEstate = doc.deceasedName === mainDeceasedName;
      
      doc.heirs.forEach(heir => {
        // فحص حالة التوكيل
        const foundPoa = poaDocs.find(p => 
          p.principals.some(principal => 
            principal.trim().includes(heir.name.trim()) || heir.name.trim().includes(principal.trim())
          )
        );

        // فحص الوكيل
        const isAgent = poaDocs.some(p => 
          p.agentName.trim().includes(heir.name.trim()) || heir.name.trim().includes(p.agentName.trim())
        );

        // النص القانوني التلقائي
        let instruction = "";
        if (isMainEstate) {
          instruction = `الوكالة يجب أن تكون خاصة بالإرث العائد من المورث (${mainDeceasedName})`;
        } else {
          instruction = `الوكالة يجب أن تكون خاصة بالإرث العائد من (${doc.deceasedName})، والعائد له من (${mainDeceasedName})، وفيما توارثوه بينهم`;
        }

        heirsSummary.push({
          name: heir.name,
          relation: heir.relation,
          idNo: heir.idNo,
          deceasedOf: doc.deceasedName,
          isMain: isMainEstate,
          isAuthorized: !!foundPoa,
          isAgent: isAgent,
          agentName: isAgent ? "نفسه (وكيل)" : (foundPoa ? foundPoa.agentName : "-"),
          legalRequirement: instruction
        });
      });
    });

    setAnalysisResult(heirsSummary);
  };

  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
  });

  const processWithGemini = async (base64, mimeType) => {
    const systemPrompt = `
      أنت مساعد قانوني خبير في الصكوك السعودية. استخرج البيانات التالية بدقة بصيغة JSON:
      - docType: "HOSR" (لحصر الورثة) أو "POA" (للوكالة).
      - issueDate: التاريخ (YYYY-MM-DD).
      - deceasedName: اسم المتوفى الكامل.
      - heirs: قائمة الورثة [{name, relation, idNo}].
      - agentName: اسم الوكيل (في الوكالة).
      - principals: قائمة أسماء الموكلين (في الوكالة).
      أجب فقط بـ JSON.
    `;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "حلل هذا الصك:" }, { inlineData: { mimeType, data: base64 } }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { responseMimeType: "application/json" }
        })
      });

      if (!response.ok) throw new Error("API Connection Failed");
      const data = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
      return JSON.parse(content);
    } catch (err) {
      console.error("AI Error:", err);
      throw err;
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    const newItems = files.map(f => ({
      file: f,
      id: Math.random().toString(36).substr(2, 9),
      name: f.name,
      size: (f.size / 1024 / 1024).toFixed(2) + ' MB',
      type: f.type
    }));
    setPendingQueue(prev => [...prev, ...newItems]);
    setError(null);
    e.target.value = null;
  };

  const startBatchProcessing = async () => {
    if (pendingQueue.length === 0) return;

    setIsProcessing(true);
    setProgress({ current: 0, total: pendingQueue.length });
    
    for (const item of pendingQueue) {
      try {
        const base64 = await fileToBase64(item.file);
        const result = await processWithGemini(base64, item.type);
        if (result) {
          setProcessedDocs(prev => [...prev, { ...result, id: item.id, fileName: item.name }]);
        }
      } catch (err) {
        setError(`خطأ في معالجة: ${item.name}. تأكد من وضوح الملف.`);
      }
      setProgress(prev => ({ ...prev, current: prev.current + 1 }));
    }

    setPendingQueue([]);
    setIsProcessing(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-right p-4 md:p-10 font-sans" dir="rtl">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8 bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-5">
          <div className="bg-slate-900 p-4 rounded-2xl text-white shadow-xl">
            <ShieldCheck size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">منصة تدقيق التركات الذكية</h1>
            <p className="text-slate-500 text-sm mt-1">بواسطة Gemini 2.0 Flash - نسخة Vercel</p>
          </div>
        </div>
        
        <div className="flex gap-4 w-full md:w-auto">
          <button 
            onClick={() => fileInputRef.current.click()}
            disabled={isProcessing}
            className="flex-1 md:flex-none bg-slate-100 hover:bg-slate-200 text-slate-700 px-8 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all"
          >
            <Upload size={20} />
            إرفاق ملفات
          </button>
          
          {pendingQueue.length > 0 && (
            <button 
              onClick={startBatchProcessing}
              disabled={isProcessing}
              className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700 text-white px-10 py-4 rounded-2xl font-black flex items-center justify-center gap-3 shadow-lg transition-all"
            >
              {isProcessing ? <Loader2 className="animate-spin" /> : <Play size={20} fill="currentColor" />}
              {isProcessing ? `جاري العمل (${progress.current}/${progress.total})` : `بدء التحليل (${pendingQueue.length})`}
            </button>
          )}

          <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" multiple accept="application/pdf,image/*" />
        </div>
      </div>

      {error && (
        <div className="max-w-7xl mx-auto mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl flex items-center gap-2 font-bold animate-pulse">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Sidebar */}
        <div className="lg:col-span-3 space-y-6">
          {pendingQueue.length > 0 && (
            <div className="bg-white p-6 rounded-[2rem] border-2 border-dashed border-blue-100">
              <h2 className="text-xs font-black text-blue-700 mb-4 flex items-center gap-2">
                <Clock size={16} /> قائمة الانتظار
              </h2>
              <div className="space-y-2">
                {pendingQueue.map((f) => (
                  <div key={f.id} className="bg-blue-50/50 p-3 rounded-xl border border-blue-50 flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-800 truncate pl-2">{f.name}</span>
                    <button onClick={() => setPendingQueue(prev => prev.filter(x => x.id !== f.id))}><X size={14} className="text-blue-300" /></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2 border-b pb-4">
              <Calendar className="text-blue-600" size={20} /> التسلسل الزمني
            </h2>
            {processedDocs.length === 0 ? (
              <div className="py-10 text-center text-slate-300 italic text-sm">بانتظار التحليل...</div>
            ) : (
              <div className="space-y-4 relative before:absolute before:right-4 before:top-0 before:bottom-0 before:w-0.5 before:bg-slate-50">
                {[...processedDocs].sort((a,b) => new Date(a.issueDate) - new Date(b.issueDate)).map((doc) => (
                  <div key={doc.id} className="relative pr-9 group">
                    <div className="absolute right-2.5 top-3 w-3 h-3 rounded-full bg-blue-500 border-2 border-white shadow-sm ring-4 ring-white"></div>
                    <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200 hover:border-blue-200 transition-all">
                      <button onClick={() => setProcessedDocs(prev => prev.filter(d => d.id !== doc.id))} className="absolute left-2 top-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={14} /></button>
                      <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">{doc.docType === 'HOSR' ? 'حصر' : 'وكالة'}</span>
                      <h4 className="font-bold text-slate-800 text-[11px] mt-1 truncate">{doc.fileName}</h4>
                      <div className="text-[9px] text-slate-400 mt-1">{doc.issueDate}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="lg:col-span-9">
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-8 border-b border-slate-100 bg-white flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                <Users className="text-blue-600" /> مراجعة الورثة
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-[11px] font-black uppercase tracking-widest">
                    <th className="px-6 py-5 border-b">المتوفى</th>
                    <th className="px-6 py-5 border-b">الوارث</th>
                    <th className="px-6 py-5 border-b text-center">التوكيل</th>
                    <th className="px-6 py-5 border-b">الوكيل</th>
                    <th className="px-6 py-5 border-b">الشرط القانوني المطلوب</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {analysisResult.map((heir, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-6">
                        <span className={`text-[10px] font-bold px-3 py-1.5 rounded-xl border ${heir.isMain ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>
                          {heir.deceasedOf}
                        </span>
                      </td>
                      <td className="px-6 py-6">
                        <div className="font-bold text-slate-800 text-sm">{heir.name}</div>
                        <div className="text-[10px] text-slate-400 mt-1 font-mono tracking-tight">{heir.idNo || '---'}</div>
                      </td>
                      <td className="px-6 py-6 text-center">
                        <div className={`w-11 h-11 rounded-2xl mx-auto flex items-center justify-center shadow-sm ${heir.isAuthorized ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-500'}`}>
                          {heir.isAuthorized ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
                        </div>
                      </td>
                      <td className="px-6 py-6">
                        <div className="text-sm font-bold text-slate-700">{heir.agentName}</div>
                        {heir.isAgent && (
                          <div className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-black text-orange-600 bg-orange-50 px-3 py-1 rounded-lg border border-orange-100">
                            <Info size={12} /> المفترض يكون حاضر
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-6 max-w-[280px]">
                        <div className="text-[10px] leading-relaxed text-slate-500 bg-slate-50 p-4 rounded-2xl border border-slate-100 border-dashed italic">
                          {heir.legalRequirement}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {analysisResult.length === 0 && !isProcessing && (
                <div className="py-32 text-center text-slate-300">
                  <FileSearch size={64} className="mx-auto mb-4 opacity-10" />
                  <p className="font-bold">ارفع الصكوك للبدء في التحليل الذكي</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
