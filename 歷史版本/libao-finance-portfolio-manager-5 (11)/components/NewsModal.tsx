
import React from 'react';
import { X, Newspaper, ExternalLink, Calendar } from 'lucide-react';
import { NewsItem } from '../types';

interface NewsModalProps {
  isOpen: boolean;
  onClose: () => void;
  newsItems: NewsItem[];
  isLoading: boolean;
}

const NewsModal: React.FC<NewsModalProps> = ({ isOpen, onClose, newsItems, isLoading }) => {
  if (!isOpen) return null;

  // Group news by symbol for better readability
  // Or simply sort by date descending
  const sortedNews = [...newsItems].sort((a, b) => 
    new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[250] p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gray-800 p-4 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2 font-bold text-lg">
             <Newspaper className="w-5 h-5 text-yellow-400" /> 
             持股新聞 (Stock News)
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-full transition-colors"><X className="w-6 h-6"/></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
           {isLoading ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600 mb-2"></div>
                 <p>正在搜尋相關新聞...</p>
              </div>
           ) : sortedNews.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                 <Newspaper className="w-12 h-12 opacity-20 mb-2" />
                 <p>目前沒有相關的最新新聞</p>
              </div>
           ) : (
              <div className="space-y-3">
                 {sortedNews.map((item, idx) => (
                    <a 
                      key={idx} 
                      href={item.link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="block bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all group"
                    >
                       <div className="flex justify-between items-start gap-3">
                          <div className="flex-1">
                             <div className="flex items-center gap-2 mb-1">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded text-white ${item.market === 'TW' ? 'bg-red-500' : 'bg-blue-500'}`}>
                                   {item.symbol}
                                </span>
                                <span className="text-xs text-gray-500 flex items-center gap-1">
                                   {item.source} • {new Date(item.pubDate).toLocaleDateString()} {new Date(item.pubDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </span>
                             </div>
                             <h4 className="font-bold text-gray-800 leading-snug group-hover:text-blue-600 transition-colors">
                                {item.title}
                             </h4>
                          </div>
                          <ExternalLink className="w-4 h-4 text-gray-300 group-hover:text-blue-500 shrink-0 mt-1" />
                       </div>
                    </a>
                 ))}
                 <div className="text-center text-xs text-gray-400 pt-4">
                    資料來源：Google News
                 </div>
              </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default NewsModal;
