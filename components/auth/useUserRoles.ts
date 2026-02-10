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
        let firestoreUnsub1: (() => void) | undefined; // For uid-based user_directory
        let firestoreUnsub2: (() => void) | undefined; // For email-based users
        let authUnsub: (() => void) | undefined;

        if (!auth) {
            setLoading(false);
            return;
        }

        authUnsub = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);

            // Cleanup previous Firestore listeners
            if (firestoreUnsub1) {
                firestoreUnsub1();
                firestoreUnsub1 = undefined;
            }
            if (firestoreUnsub2) {
                firestoreUnsub2();
                firestoreUnsub2 = undefined;
            }

            if (!currentUser) {
                setRoles([]);
                setLoading(false);
                return;
            }

            setLoading(true);

            // 1. System A: user_directory (By UID)
            const userDirRef = doc(db, 'user_directory', currentUser.uid);

            // 2. System B: users (By Email - Webhook)
            const emailKey = currentUser.email?.toLowerCase().trim();
            const userRef = emailKey ? doc(db, 'users', emailKey) : null;

            let rolesA: string[] = [];
            let rolesB: string[] = [];

            const updateMergedRoles = () => {
                const combined = Array.from(new Set([...rolesA, ...rolesB]));
                setRoles(combined);
                setLoading(false);
            };

            // Listen to System A
            firestoreUnsub1 = onSnapshot(userDirRef, (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    // System A uses 'role' as a single string
                    rolesA = data.role ? [data.role] : [];
                } else {
                    rolesA = [];
                }
                updateMergedRoles();
            }, (err) => {
                console.error("System A fetch failed:", err);
                updateMergedRoles();
            });

            // Listen to System B
            if (userRef) {
                firestoreUnsub2 = onSnapshot(userRef, (docSnap) => {
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        // System B uses 'roles' as an array
                        rolesB = Array.isArray(data.roles) ? data.roles : [];
                    } else {
                        rolesB = [];
                    }
                    updateMergedRoles();
                }, (err) => {
                    console.error("System B fetch failed:", err);
                    updateMergedRoles();
                });
            } else {
                updateMergedRoles();
            }
        });

        return () => {
            if (authUnsub) authUnsub();
            if (firestoreUnsub1) firestoreUnsub1();
            if (firestoreUnsub2) firestoreUnsub2();
        };
    }, []);

    const hasRole = (role: string) => roles.includes(role);
    // Combined logic: member, vip, first_class or admin all qualify for member access
    const isMember = hasRole('member') || hasRole('first_class') || hasRole('vip') || hasRole('admin');
    const isFirstClass = hasRole('first_class') || hasRole('vip') || hasRole('admin');

    return { loading, user, roles, hasRole, isMember, isFirstClass };
};
