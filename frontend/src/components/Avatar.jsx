export const DEFAULT_AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='50' fill='%23334155'/><circle cx='50' cy='38' r='18' fill='%2394a3b8'/><path d='M20 84c0-16.57 13.43-30 30-30s30 13.43 30 30z' fill='%2394a3b8'/></svg>";

export const Avatar = ({
  src,
  alt = "User avatar",
  size = 40,
  className = "",
  style = {},
  onClick,
}) => {
  const imageSrc = src && typeof src === "string" && src.trim() !== "" ? src : DEFAULT_AVATAR;

  return (
    <div
      className={`avatar ${className}`}
      onClick={onClick}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        minWidth: `${size}px`,
        minHeight: `${size}px`,
        borderRadius: "50%",
        overflow: "hidden",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#1e293b",
        flexShrink: 0,
        ...style,
      }}
    >
      <img
        src={imageSrc}
        alt={alt}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
        }}
        onError={(e) => {
          e.currentTarget.onerror = null;
          e.currentTarget.src = DEFAULT_AVATAR;
        }}
      />
    </div>
  );
};
