import type { CartSummary } from "../../../src/contracts/cart";
import { formatPrice } from "../format";

interface CartPanelProps {
  open: boolean;
  cart: CartSummary;
  onClose: () => void;
  onQuantity: (productId: string, quantity: number) => void;
  onCheckout: () => void;
}

export function CartPanel({ open, cart, onClose, onQuantity, onCheckout }: CartPanelProps) {
  return (
    <>
      <div className={`scrim ${open ? "is-open" : ""}`} onClick={onClose} aria-hidden="true" />
      <aside className={`cart-panel ${open ? "is-open" : ""}`} aria-label="Cart" aria-hidden={!open}>
        <div className="cart-head">
          <h2>Your cart</h2>
          <button type="button" className="link" onClick={onClose}>
            Close
          </button>
        </div>

        {cart.lines.length === 0 ? (
          <p className="cart-empty">Nothing here yet.</p>
        ) : (
          <ul className="cart-lines">
            {cart.lines.map((line) => (
              <li key={line.productId} className="cart-line">
                <span className="cart-line-art">{line.emoji}</span>
                <div className="cart-line-main">
                  <p>{line.name}</p>
                  <div className="stepper">
                    <button type="button" onClick={() => onQuantity(line.productId, line.quantity - 1)}>
                      −
                    </button>
                    <span>{line.quantity}</span>
                    <button type="button" onClick={() => onQuantity(line.productId, line.quantity + 1)}>
                      +
                    </button>
                  </div>
                </div>
                <span className="price">{formatPrice(line.lineTotalCents)}</span>
              </li>
            ))}
          </ul>
        )}

        <dl className="cart-totals">
          <div>
            <dt>Subtotal</dt>
            <dd>{formatPrice(cart.subtotalCents)}</dd>
          </div>
          <div className="cart-total">
            <dt>Total</dt>
            <dd>{formatPrice(cart.totalCents)}</dd>
          </div>
        </dl>
        <button type="button" className="button button-wide" disabled={cart.itemCount === 0} onClick={onCheckout}>
          Check out
        </button>
      </aside>
    </>
  );
}
