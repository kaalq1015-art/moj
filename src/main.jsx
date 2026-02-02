text-orange-600 bg-orange-50 px-2 py-1 rounded-lg border border-orange-100">المفترض يكون حاضر</div>}</td>
                    <td className="p-5 text-[10px] text-slate-500 leading-relaxed max-w-[250px] italic">{h.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {analysisResults.length === 0 && <div className="py-32 text-center text-slate-300"><FileSearch size={64} className="mx-auto mb-4 opacity-10" /><p className="font-bold">ارفع الصكوك ثم اضغط "بدء المعالجة"</p></div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
