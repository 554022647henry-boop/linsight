import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Dish } from '../types';

export interface CartLine {
  dish: Dish;
  quantity: number;
}

interface CartContextValue {
  lines: CartLine[];
  tableNo: string | null;
  setTableNo: (v: string | null) => void;
  add: (dish: Dish) => void;
  inc: (dishId: number) => void;
  dec: (dishId: number) => void;
  remove: (dishId: number) => void;
  clear: () => void;
  quantityOf: (dishId: number) => number;
  totalCount: number;
  totalAmount: number;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [map, setMap] = useState<Map<number, CartLine>>(new Map());
  const [tableNo, setTableNo] = useState<string | null>(null);

  const value = useMemo<CartContextValue>(() => {
    const lines = Array.from(map.values()).sort(
      (a, b) => a.dish.sort_order - b.dish.sort_order || a.dish.id - b.dish.id,
    );

    return {
      lines,
      tableNo,
      setTableNo,
      add: (dish) => {
        setMap((prev) => {
          const next = new Map(prev);
          const cur = next.get(dish.id);
          next.set(dish.id, { dish, quantity: (cur?.quantity ?? 0) + 1 });
          return next;
        });
      },
      inc: (dishId) => {
        setMap((prev) => {
          const next = new Map(prev);
          const cur = next.get(dishId);
          if (!cur) return prev;
          next.set(dishId, { ...cur, quantity: cur.quantity + 1 });
          return next;
        });
      },
      dec: (dishId) => {
        setMap((prev) => {
          const next = new Map(prev);
          const cur = next.get(dishId);
          if (!cur) return prev;
          if (cur.quantity <= 1) {
            next.delete(dishId);
          } else {
            next.set(dishId, { ...cur, quantity: cur.quantity - 1 });
          }
          return next;
        });
      },
      remove: (dishId) => {
        setMap((prev) => {
          const next = new Map(prev);
          next.delete(dishId);
          return next;
        });
      },
      clear: () => setMap(new Map()),
      quantityOf: (dishId) => map.get(dishId)?.quantity ?? 0,
      totalCount: lines.reduce((s, l) => s + l.quantity, 0),
      totalAmount: lines.reduce((s, l) => s + l.dish.price * l.quantity, 0),
    };
  }, [map, tableNo]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart 必须在 CartProvider 内使用');
  return ctx;
}
