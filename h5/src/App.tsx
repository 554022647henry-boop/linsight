import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { CartProvider } from './cart/CartContext';
import MenuPage from './pages/MenuPage';
import ConfirmPage from './pages/ConfirmPage';
import SuccessPage from './pages/SuccessPage';

export default function App() {
  return (
    <BrowserRouter>
      <CartProvider>
        <Routes>
          <Route path="/" element={<MenuPage />} />
          <Route path="/confirm" element={<ConfirmPage />} />
          <Route path="/success" element={<SuccessPage />} />
        </Routes>
      </CartProvider>
    </BrowserRouter>
  );
}
