type LogoProps = {
  href?: string;
};

/** BTORN 文字 logo，中间的 O 是粉色（样式见 styles.css 的 .brand） */
export function Logo({ href = '#' }: LogoProps) {
  return (
    <a href={href} className="brand" aria-label="BTORN home">
      BT<span>O</span>RN
    </a>
  );
}
