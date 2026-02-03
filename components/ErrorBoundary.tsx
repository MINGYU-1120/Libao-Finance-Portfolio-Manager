import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorInfo: null };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("ErrorBoundary caught an error:", error, errorInfo);
        this.setState({ error, errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '40px', backgroundColor: '#FEF2F2', color: '#1F2937', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ maxWidth: '800px', width: '100%', backgroundColor: 'white', padding: '32px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                        <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#DC2626', marginBottom: '16px' }}>
                            Something went wrong
                        </h1>
                        <p style={{ marginBottom: '24px', color: '#4B5563' }}>
                            An error occurred while rendering the application.
                        </p>
                        {this.state.error && (
                            <div style={{ backgroundColor: '#F3F4F6', padding: '16px', borderRadius: '8px', overflowX: 'auto', fontFamily: 'monospace', fontSize: '14px', marginBottom: '16px', border: '1px solid #E5E7EB' }}>
                                <strong style={{ color: '#DC2626' }}>{this.state.error.toString()}</strong>
                                <pre style={{ marginTop: '8px', color: '#6B7280', fontSize: '12px' }}>
                                    {this.state.errorInfo?.componentStack}
                                </pre>
                            </div>
                        )}
                        <button
                            onClick={() => window.location.reload()}
                            style={{ padding: '10px 20px', backgroundColor: '#2563EB', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', transition: 'background-color 0.2s' }}
                        >
                            Reload Page
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
