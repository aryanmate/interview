"use client"

import { UserDetailContext } from '@/context/UserDetailContext';
import { supabase } from '@/services/supabaseClient'
import { User } from 'lucide-react';

import React, { useContext, useEffect, useState } from 'react'

const Provider = ({ children }) => {
    const [user,setUser]=useState();

    useEffect(() => {
        CreateNewUser();
        const { data: subscription } = supabase.auth.onAuthStateChange(() => {
            CreateNewUser();
        });

        const channel = supabase
            .channel('user-changes')
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'Users',
                filter: user?.email ? `email=eq.${user.email}` : undefined
            }, (payload) => {
                setUser(payload.new);
            })
            .subscribe();

        return () => {
            subscription?.subscription?.unsubscribe?.();
            supabase.removeChannel(channel);
        }
    }, [user?.email]);

    const CreateNewUser = () => {
        supabase.auth.getUser().then(async ({ data, error }) => {
            if (error) {
                console.error('Error fetching auth user:', error.message);
                return;
            }
            const authUser = data?.user;
            if (!authUser) {
                return;
            }

            const { data: existingUsers, error: selectError } = await supabase
                .from('Users')
                .select('*')
                .eq('email', authUser.email);

            if (selectError) {
                console.error('Error querying Users table:', selectError.message);
                return;
            }

            if (!existingUsers || existingUsers.length === 0) {
                const { data: insertedUser, error: insertError } = await supabase
                    .from('Users')
                    .insert([
                        {
                            name: authUser.user_metadata?.name,
                            email: authUser.email,
                            picture: authUser.user_metadata?.picture
                        }
                    ])
                    .select()
                    .single();

                if (insertError) {
                    console.error('Error inserting user:', insertError.message);
                    return;
                }
                setUser(insertedUser);
                return;
            }

            setUser(existingUsers[0]);
        })
    }
    return (
    <UserDetailContext.Provider value={{ user, setUser }}>
        <div>
            {children}
        </div>
    </UserDetailContext.Provider>
    )
}

export default Provider

export const useUser=()=>{
    const context=useContext(UserDetailContext);
    return context;
}