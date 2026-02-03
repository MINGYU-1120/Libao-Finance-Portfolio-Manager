import React from 'react';
import { Lock } from 'lucide-react';

interface SectionTeaserProps {
    title: string;
}

const SectionTeaser: React.FC<SectionTeaserProps> = ({ title }) => {
    return (
        <div className="relative w-full h-64 bg-gray-900 rounded-2xl overflow-hidden border border-gray-800 group">
            {/* Blurred Content Background (Skeleton) */}
            <div className="absolute inset-0 p-6 opacity-30 blur-sm pointer-events-none select-none flex flex-col gap-4">
                <div className="h-8 bg-gray-700 w-1/3 rounded"></div>
                <div className="grid grid-cols-3 gap-4">
                    <div className="h-32 bg-gray-800 rounded-xl"></div>
                    <div className="h-32 bg-gray-800 rounded-xl"></div>
                    <div className="h-32 bg-gray-800 rounded-xl"></div>
                </div>
                <div className="space-y-2">
                    <div className="h-4 bg-gray-700 w-full rounded"></div>
                    <div className="h-4 bg-gray-700 w-5/6 rounded"></div>
                    <div className="h-4 bg-gray-700 w-4/6 rounded"></div>
                </div>
            </div>

            {/* Overlay Frame */}
            <div className="absolute inset-0 bg-gradient-to-t from-gray-950/90 via-gray-950/60 to-transparent flex flex-col items-center justify-center text-center p-6 space-y-4">
                <div className="p-4 bg-gray-800/80 rounded-full backdrop-blur-md shadow-2xl ring-1 ring-white/10 animate-pulse">
                    <Lock className="w-8 h-8 text-libao-gold" />
                </div>
                <div className="space-y-1">
                    <h3 className="text-xl font-bold text-white tracking-tight">解鎖「{title}」完整內容</h3>
                    <p className="text-gray-400 text-sm max-w-xs mx-auto">此板塊包含即時市場內線與深度分析。請升級您的權限以獲取完整存取權。</p>
                </div>
                <button
                    onClick={() => alert("請聯繫管理員升級您的權限：\n1033023@ntsu.edu.tw")}
                    className="px-6 py-2.5 bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-gray-950 font-black rounded-xl shadow-lg shadow-yellow-900/20 transform transition-all active:scale-95 flex items-center gap-2"
                >
                    升級權限
                </button>
            </div>
        </div>
    );
};

export default SectionTeaser;
