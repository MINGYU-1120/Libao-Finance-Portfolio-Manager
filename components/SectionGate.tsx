import React, { useEffect, useState } from 'react';
import { UserRole, AccessTier, getTier } from '../types';
import SectionTeaser from './SectionTeaser';
import { Lock } from 'lucide-react';
import maskImg from '../assets/mask_overlay.png';
import { getSectionMinTier } from '../services/firebase';

interface SectionGateProps {
    sectionKey: string;
    title: string;
    userRole: UserRole;
    children: React.ReactNode;
    allowPartial?: boolean;
}

const SectionGate: React.FC<SectionGateProps> = ({ sectionKey, title, userRole, children, allowPartial = false }) => {
    // Default to strict (ADMIN) for security during load
    const [minTier, setMinTier] = useState<AccessTier>(AccessTier.ADMIN);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Determine permissions for this section
        const fetchPerms = async () => {
            try {
                // Now fetches Min Tier from Firestore
                const tier = await getSectionMinTier(sectionKey);
                setMinTier(tier);
            } catch (e) {
                console.error("Failed to fetch permissions", e);
                // Keep default safe closed
            } finally {
                setLoading(false);
            }
        };
        fetchPerms();

        // Optional: Poll for changes every 30s
        const interval = setInterval(fetchPerms, 30000);
        return () => clearInterval(interval);
    }, [sectionKey]);

    if (loading) {
        return <div className="h-64 bg-gray-900 rounded-2xl animate-pulse"></div>;
    }

    const userTier = getTier(userRole);
    // Core Logic: User's Tier Must be Greater or Equal to Section's Min Tier
    const isAllowed = userTier >= minTier;

    if (!isAllowed) {
        if (allowPartial) {
            return (
                <div className="relative w-full overflow-hidden group">
                    {/* Blurred Content - Replaced with Static Image for Security */}
                    <div className="filter blur-[2px] opacity-80 select-none pointer-events-none transition-all duration-500">
                        <img src={maskImg} alt="Locked Content" className="w-full min-h-[400px] object-cover rounded-xl" />
                    </div>

                    {/* Overlay Frame */}
                    <div className="absolute inset-0 bg-gradient-to-t from-white/90 via-white/60 to-transparent z-10 flex flex-col items-center justify-center text-center p-6">
                        <div className="p-4 bg-white rounded-full backdrop-blur-md shadow-xl ring-1 ring-gray-200 animate-pulse mb-4">
                            <Lock className="w-8 h-8 text-yellow-500" />
                        </div>
                        <h3 className="text-2xl font-black text-gray-900 mb-2">
                            解鎖「{title}」
                        </h3>
                        <p className="text-gray-600 font-bold text-sm mb-6 max-w-sm">
                            此區域需要 <span className="text-indigo-600 font-black">
                                {minTier === AccessTier.ADMIN ? '管理員' :
                                    minTier === AccessTier.FIRST_CLASS ? '頭等艙 (VIP)' :
                                        minTier === AccessTier.STANDARD ? '會員' : '訪客'}
                            </span> 等級權限以查看完整策略佈局與即時數據
                        </p>
                        <button
                            onClick={() => alert("請聯繫管理員升級您的權限：\n1033023@ntsu.edu.tw")}
                            className="px-8 py-3 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-white font-black rounded-xl shadow-lg shadow-yellow-900/40 transform transition-all hover:scale-105 active:scale-95 border border-yellow-400/20"
                        >
                            立即升級獲取權限
                        </button>
                    </div>
                </div>
            );
        }
        return <SectionTeaser title={title} />;
    }

    return <>{children}</>;
};

export default SectionGate;
