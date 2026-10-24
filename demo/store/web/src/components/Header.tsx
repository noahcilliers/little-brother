interface HeaderProps {
  itemCount: number;
  onOpenCart: () => void;
}

export function Header({ itemCount, onOpenCart }: HeaderProps) {
  return (
    <header className="header">
      <a className="brand" href="/">
        Quill <span>&amp;</span> Kettle
      </a>
      <nav className="header-actions">
        <button type="button" className="cart-button" onClick={onOpenCart}>
          Cart
          <span className="cart-count" aria-label={`${itemCount} items`}>
            {itemCount}
          </span>
        </button>
      </nav>
    </header>
  );
}
