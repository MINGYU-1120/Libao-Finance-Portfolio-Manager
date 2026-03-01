import { CalculatedCategory, CalculatedAsset, AppSettings, UserRole, TransactionRecord, MartingaleFeeSettings } from '../types';
import DetailTable from './DetailTable';
import MartingaleSummary from './MartingaleSummary';
import MartingaleDashboard from './MartingaleDashboard';
import { ShieldAlert, Users, GraduationCap } from 'lucide-react';
import { OrderData } from './OrderModal';
import { IndustryData } from './charts/MartingaleIndustryChart'; // Import type from new chart

interface MartingaleOperations {
    onExecuteOrder: (categoryId: string, order: OrderData) => void;
    onDeleteAsset: (categoryId: string, assetId: string) => void;
    onUpdatePrice: (categoryId: string) => Promise<void>;
    onUpdateAssetPrice: (categoryId: string, assetId: string, symbol: string, market: string) => Promise<void>;
    onDeleteCategory: (categoryId: string) => void;
    onMoveCategory: (categoryId: string, direction: 'up' | 'down') => void;
    onTransferCash: (fromId: string, toId: string, amount: number, mode: 'budget' | 'profit') => void;
}

interface MartingalePanelProps {
    categories: CalculatedCategory[];
    totalCapital: number;
    userRole: UserRole;
    isPrivacyMode: boolean;
    settings: AppSettings;
    onEditCategory: (id: string, name: string, allocation: number, note: string) => void;
    onAddCategory: () => void;
    operations: MartingaleOperations;
    activeCategoryId: string | null;
    onSetActiveCategory: (id: string | null) => void;
    transactions?: TransactionRecord[];
    industryData?: IndustryData[]; // New Prop
    onDeposit?: () => void; // New Prop
    onReset?: () => void; // New Reset Prop
    isMasked?: boolean;
    martingaleFeeSettings?: MartingaleFeeSettings; // 馬丁策略專屬手續費設定
}

const MartingalePanel: React.FC<MartingalePanelProps> = ({
    categories,
    totalCapital,
    userRole,
    isPrivacyMode,
    settings,
    onEditCategory = () => { },
    onAddCategory,
    operations,
    activeCategoryId,
    onSetActiveCategory,
    transactions = [],
    industryData, // destructure
    onDeposit, // destructure
    onReset,
    isMasked = false,
    martingaleFeeSettings
}) => {
    const isAdmin = userRole === 'admin';
    const readOnly = !isAdmin;

    // 將馬丁專屬手續費設定覆蓋全域設定，傳入下單 Modal
    const effectiveSettings: AppSettings = {
        ...settings,
        ...(martingaleFeeSettings ?? {})
    };

    const activeCategory = categories.find(c => c.id === activeCategoryId);

    return (
        <div className="mt-4 relative">
            {/* Header moved to parent (App.tsx) to stay outside blur */}

            {/* Header moved to parent (App.tsx) to stay outside blur */}

            {activeCategoryId && activeCategory ? (
                <DetailTable
                    category={activeCategory}
                    assets={activeCategory.assets}
                    totalCapital={totalCapital}
                    defaultExchangeRate={settings.usExchangeRate}
                    onBack={() => onSetActiveCategory(null)}
                    onExecuteOrder={(order) => operations.onExecuteOrder(activeCategory.id, order)}

                    onUpdateAssetPrice={(assetId, symbol, market) => operations.onUpdateAssetPrice(activeCategory.id, assetId, symbol, market)}
                    onUpdateCategoryPrices={() => operations.onUpdatePrice(activeCategory.id)}
                    onUpdateAssetNote={() => { }} // Not implemented in top level yet based on props
                    isPrivacyMode={isPrivacyMode}
                    settings={effectiveSettings}
                    readOnly={readOnly}
                    isMasked={isMasked}
                />
            ) : (
                <>
                    {/* Dashboard Area - Only show if not drilling down */}
                    <div className="mb-8">
                        <MartingaleDashboard
                            categories={categories}
                            totalCapital={totalCapital}
                            transactions={transactions}
                            industryData={industryData} // Pass it down
                            onDeposit={isAdmin ? onDeposit : undefined} // Only admin can update capital
                            onReset={isAdmin ? onReset : undefined} // Only admin can reset
                            isPrivacyMode={isPrivacyMode}
                        />
                    </div>

                    <MartingaleSummary
                        categories={categories}
                        totalCapital={totalCapital}
                        onSelectCategory={(id) => onSetActiveCategory(id)}
                        onRefreshCategory={operations.onUpdatePrice}
                        onEditCategory={onEditCategory}
                        onDeleteCategory={operations.onDeleteCategory}
                        onMoveCategory={operations.onMoveCategory}
                        onTransferCash={operations.onTransferCash}
                        onAddCategory={onAddCategory} // Pass prop
                        isPrivacyMode={isPrivacyMode}
                        readOnly={readOnly}
                        isMasked={isMasked}
                        userRole={userRole}
                    />
                </>
            )}
        </div>
    );
};

export default MartingalePanel;
