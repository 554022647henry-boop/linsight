import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { CartProvider } from './cart/CartContext';
import MenuPage from './pages/MenuPage';
import ConfirmPage from './pages/ConfirmPage';
import Payment from './pages/Payment';
import SuccessPage from './pages/SuccessPage';
import OrderStatus from './pages/OrderStatus';

export default function App() {
  return (
    <BrowserRouter>
      <CartProvider>
        <Routes>
          <Route path="/" element={<MenuPage />} />
          <Route path="/confirm" element={<ConfirmPage />} />
          <Route path="/payment" element={<Payment />} />
          <Route path="/success" element={<SuccessPage />} />
          <Route path="/order/:id" element={<OrderStatus />} />
        </Routes>
      </CartProvider>
    </BrowserRouter>
  );
}
