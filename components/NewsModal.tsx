
import React, { useState } from 'react';
import { X, Newspaper, ExternalLink, Bell, Globe } from 'lucide-react';
import { NewsItem } from '../types';

export interface PushNotification {
   id: string;
   title: string;
   body: string;
   url?: string;
   createdAt: any; // Firestore timestamp
   type?: string;
}

interface NewsModalProps {
   isOpen: boolean;
   onClose: () => void;
   newsItems: NewsItem[];
   isLoading: boolean;
   pushHistory: PushNotification[];
   isLoadingHistory: boolean;
   onNavigate?: (url: string) => void;
}

const NewsModal: React.FC<NewsModalProps> = ({
   isOpen,
   onClose,
   newsItems,
   isLoading,
   pushHistory,
   isLoadingHistory,
   onNavigate
}) => {
   const [activeTab, setActiveTab] = useState<'news' | 'push'>('push');

   if (!isOpen) return null;

   // Group news by symbol for better readability
   // Or simply sort by date descending
   const sortedNews = [...newsItems].sort((a, b) =>
      new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
   );

   return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[250] p-4 animate-in fade-in duration-200">
         <div className="bg-white w-full max-w-2xl h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">

            {/* Header Tabs */}
            <div className="bg-gray-800 p-2 shrink-0 flex items-center justify-between">
               <div className="flex gap-2">
                  <button
                     onClick={() => setActiveTab('push')}
                     className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all ${activeTab === 'push' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-gray-700'
                        }`}
                  >
                     <Bell className={`w-4 h-4 ${activeTab === 'push' ? 'text-white' : 'text-indigo-400'}`} />
                     系統通知
                  </button>
                  <button
                     onClick={() => setActiveTab('news')}
                     className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all ${activeTab === 'news' ? 'bg-yellow-600 text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-gray-700'
                        }`}
                  >
                     <Newspaper className={`w-4 h-4 ${activeTab === 'news' ? 'text-white' : 'text-yellow-400'}`} />
                     持股新聞
                  </button>
               </div>
               <button onClick={onClose} className="hover:bg-white/10 p-2 text-gray-300 rounded-full transition-colors"><X className="w-5 h-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto bg-gray-50 p-4">
               {/* Tab Content: News */}
               {activeTab === 'news' && (
                  isLoading ? (
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
                                          {item.source} • {new Date(item.pubDate).toLocaleDateString()} {new Date(item.pubDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                  )
               )}

               {/* Tab Content: Push History */}
               {activeTab === 'push' && (
                  isLoadingHistory ? (
                     <div className="flex flex-col items-center justify-center h-full text-gray-400 py-20">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
                        <p>正在載入通知歷程...</p>
                     </div>
                  ) : pushHistory.length === 0 ? (
                     <div className="flex flex-col items-center justify-center h-full text-gray-400 py-20">
                        <Bell className="w-12 h-12 opacity-20 mb-4" />
                        <p>目前沒有任何系統通知</p>
                     </div>
                  ) : (
                     <div className="space-y-3">
                        {pushHistory.map((item) => {
                           const date = item.createdAt?.toDate ? item.createdAt.toDate() : new Date();

                           return (
                              <div
                                 key={item.id}
                                 onClick={() => {
                                    if (item.url && item.url !== '/' && onNavigate) {
                                       onNavigate(item.url);
                                       onClose();
                                    }
                                 }}
                                 className={`bg-white p-4 rounded-xl border border-gray-200 transition-all ${item.url && item.url !== '/'
                                       ? 'hover:shadow-md hover:border-indigo-300 cursor-pointer group'
                                       : ''
                                    }`}
                              >
                                 <div className="flex gap-3">
                                    <div className="mt-1 flex-shrink-0">
                                       <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                                          <Bell className="w-4 h-4" />
                                       </div>
                                    </div>
                                    <div className="flex-1">
                                       <div className="flex justify-between items-start mb-1">
                                          <h4 className={`font-bold text-gray-900 ${item.url && item.url !== '/' ? 'group-hover:text-indigo-600' : ''}`}>
                                             {item.title}
                                          </h4>
                                          <span className="text-[10px] text-gray-400 whitespace-nowrap ml-2">
                                             {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                          </span>
                                       </div>
                                       <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                                          {item.body}
                                       </p>

                                       {item.url && item.url !== '/' && (
                                          <div className="mt-3 flex items-center gap-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1.5 rounded-lg w-fit">
                                             <Globe className="w-3 h-3" />
                                             前往查看
                                          </div>
                                       )}
                                    </div>
                                 </div>
                              </div>
                           );
                        })}
                     </div>
                  )
               )}
            </div>
         </div>
      </div>
   );
};

export default NewsModal;
