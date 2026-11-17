import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { WarehouseProvider } from './context/WarehouseContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './components/AppLayout';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { Inventory } from './pages/Inventory';
import { Transactions } from './pages/Transactions';
import { Documents } from './pages/Documents';

export default function App() {
  return (
    <WarehouseProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="transactions" element={<Transactions />} />
            <Route path="documents" element={<Documents />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </WarehouseProvider>
  );
}
