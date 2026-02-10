import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../../services/firebase';

export interface UserRoles {
    loading: boolean;
    user: User | null;
    roles: string[];
    hasRole: (role: string) => boolean;
    isMember: boolean;
    isFirstClass: boolean;
}

export const useUserRoles = (): UserRoles => {
    const [user, setUser] = useState<User | null>(null);
    const [roles, setRoles] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let firestoreUnsub: (() => void) | undefined;
        let authUnsub: (() => void) | undefined;

        if (!auth) {
            setLoading(false);
            return;
        }

        authUnsub = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);

            // Cleanup previous Firestore listener if user changes
            if (firestoreUnsub) {
                firestoreUnsub();
                firestoreUnsub = undefined;
            }

            if (!currentUser || !currentUser.email) {
                setRoles([]);
                setLoading(false);
                return;
            }

            setLoading(true); // User found, re-enable loader while checking permissions

            const emailKey = currentUser.email.toLowerCase().trim();
            const userRef = doc(db, 'users', emailKey);

            // Real-time listener for role updates
            firestoreUnsub = onSnapshot(userRef, (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const userRoles = Array.isArray(data.roles) ? data.roles : [];
                    setRoles(userRoles);
                } else {
                    // Doc doesn't exist = Guest
                    setRoles([]);
                }
                setLoading(false);
            }, (err) => {
                console.error("Failed to fetch user roles:", err);
                setRoles([]);
                setLoading(false);
            });
        });

        return () => {
            if (authUnsub) authUnsub();
            if (firestoreUnsub) firestoreUnsub();
        };
    }, []);

    const hasRole = (role: string) => roles.includes(role);
    // 'first_class' implies 'member' privileges if logic requires, otherwise strict check.
    // Assuming basic hierarchy:
    const isMember = hasRole('member') || hasRole('first_class');
    const isFirstClass = hasRole('first_class');

    return { loading, user, roles, hasRole, isMember, isFirstClass };
};
