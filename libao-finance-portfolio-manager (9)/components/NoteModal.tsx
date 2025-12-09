
import React, { useState, useEffect } from 'react';
import { X, Save, FileText, StickyNote } from 'lucide-react';

interface NoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbol: string;
  name: string;
  initialNote: string;
  onSave: (note: string) => void;
}

const NoteModal: React.FC<NoteModalProps> = ({
  isOpen,
  onClose,
  symbol,
  name,
  initialNote,
  onSave
}) => {
  const [note, setNote] = useState(initialNote);

  useEffect(() => {
    if (isOpen) {
      setNote(initialNote);
    }
  }, [isOpen, initialNote]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(note);
    onClose();
  };

  const insertTemplate = () => {
    const template = `【進場理由】\n\n【停損點位】\n\n【停利目標】\n\n【觀察重點】\n`;
    setNote(prev => prev ? prev + '\n\n' + template : template);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-yellow-500 p-4 text-white flex justify-between items-center rounded-t-2xl shrink-0">
          <div className="flex items-center gap-2 font-bold text-lg">
             <StickyNote className="w-5 h-5 text-white" /> 
             投資筆記 (Trading Journal)
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-full"><X className="w-6 h-6"/></button>
        </div>

        <div className="p-6 flex flex-col gap-4 flex-1 overflow-hidden">
           <div className="flex items-center justify-between">
              <div>
                 <h3 className="font-bold text-xl text-gray-800 flex items-center gap-2">
                    <span className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">{symbol}</span>
                    {name}
                 </h3>
                 <p className="text-xs text-gray-500 mt-1">記錄您的交易策略與心得</p>
              </div>
              <button 
                onClick={insertTemplate}
                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-full border border-gray-300 transition-colors"
              >
                插入模板
              </button>
           </div>

           <div className="flex-1 relative">
              <textarea 
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full h-full p-4 bg-yellow-50 border border-yellow-200 rounded-xl resize-none focus:ring-2 focus:ring-yellow-400 outline-none text-gray-700 leading-relaxed shadow-inner"
                placeholder="寫下您的進場理由、停損規劃或是財報分析..."
              />
              <FileText className="absolute bottom-4 right-4 w-12 h-12 text-yellow-600 opacity-10 pointer-events-none" />
           </div>

           <div className="flex justify-end gap-3 pt-2">
              <button 
                onClick={onClose}
                className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg font-medium transition-colors"
              >
                取消
              </button>
              <button 
                onClick={handleSave}
                className="px-6 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-bold shadow-md transition-all flex items-center gap-2"
              >
                <Save className="w-4 h-4" /> 儲存筆記
              </button>
           </div>
        </div>

      </div>
    </div>
  );
};

export default NoteModal;
