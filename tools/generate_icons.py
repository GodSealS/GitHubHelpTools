#!/usr/bin/env python3
"""生成 Repo Jump 扩展图标（16/32/48/128 PNG）。

纯标准库实现（zlib + struct），无需 Pillow。
使用解析式 SDF 计算边缘覆盖率，得到平滑抗锯齿（1 倍采样即够）。

用法：python tools/generate_icons.py
输出：extension/icons/icon{16,32,48,128}.png

所有几何坐标定义在 128x128 的"设计空间"里，按目标尺寸等比缩放。
"""

import math
import os
import struct
import zlib

OUT_DIR = os.path.normpath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "extension", "icons")
)
SIZES = (16, 32, 48, 128)

# ---------- 设计（128x128 空间） ----------

CORNER_RADIUS = 26.0
BG_TOP = (37, 99, 235)      # #2563EB
BG_BOTTOM = (29, 78, 216)   # #1D4ED8
GLYPH = (255, 255, 255)

# 箭头手柄：一条圆头粗线
SHAFT_A = (42.0, 86.0)
SHAFT_B = (68.0, 60.0)
SHAFT_R = 9.0

# 箭头头部：等腰三角形，尖端朝右上 45 度
HEAD_TIP = (95.0, 33.0)
HEAD_BASE_CENTER = (73.0, 55.0)
HEAD_HALF_WIDTH = 20.0

_HALF = 0.5 * math.sqrt(2.0)
HEAD_A = HEAD_TIP
HEAD_B = (HEAD_BASE_CENTER[0] + HEAD_HALF_WIDTH * _HALF,
          HEAD_BASE_CENTER[1] + HEAD_HALF_WIDTH * _HALF)
HEAD_C = (HEAD_BASE_CENTER[0] - HEAD_HALF_WIDTH * _HALF,
          HEAD_BASE_CENTER[1] - HEAD_HALF_WIDTH * _HALF)


# ---------- SDF ----------

def sdf_rounded_box(px, py):
    """圆角方块（覆盖整个 128x128 画布）。"""
    qx = abs(px - 64.0) - (64.0 - CORNER_RADIUS)
    qy = abs(py - 64.0) - (64.0 - CORNER_RADIUS)
    outside = math.hypot(max(qx, 0.0), max(qy, 0.0))
    return outside + min(max(qx, qy), 0.0) - CORNER_RADIUS


def sdf_segment(px, py, a, b, radius):
    """圆头线段。"""
    ax, ay = a
    bx, by = b
    dx, dy = bx - ax, by - ay
    denom = dx * dx + dy * dy
    t = 0.0 if denom == 0.0 else ((px - ax) * dx + (py - ay) * dy) / denom
    t = min(1.0, max(0.0, t))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy)) - radius


def _edge(px, py, a, b):
    """点到有向边的距离（带符号，外侧为正）。"""
    ax, ay = a
    bx, by = b
    ex, ey = bx - ax, by - ay
    length = math.hypot(ex, ey)
    return ((px - ax) * ey - (py - ay) * ex) / length


def sdf_triangle(px, py, a, b, c):
    """凸三角形 SDF。"""
    orientation = _edge(c[0], c[1], a, b)
    sign = -1.0 if orientation > 0.0 else 1.0
    d = -1e9
    for start, end in ((a, b), (b, c), (c, a)):
        d = max(d, sign * _edge(px, py, start, end))
    return d


# ---------- 光栅化 ----------

def render(size):
    """返回 size x size 的 RGBA 行列表。"""
    scale = size / 128.0
    rows = []
    for y in range(size):
        row = bytearray()
        # 像素中心落在设计空间里的坐标
        # 设计空间 y 轴与图像 y 轴同向（向下），渐变自上而下
        py = (y + 0.5) / scale
        for x in range(size):
            px = (x + 0.5) / scale

            # 背景：圆角方块 + 垂直渐变
            bg_cov = _coverage(sdf_rounded_box(px, py) * scale)
            if bg_cov <= 0.0:
                row += b"\x00\x00\x00\x00"
                continue

            t = min(1.0, max(0.0, (y + 0.5) / size))
            r = BG_TOP[0] + (BG_BOTTOM[0] - BG_TOP[0]) * t
            g = BG_TOP[1] + (BG_BOTTOM[1] - BG_TOP[1]) * t
            b = BG_TOP[2] + (BG_BOTTOM[2] - BG_TOP[2]) * t

            # 前景：箭头（手柄 ∪ 箭头头部）
            glyph_cov = max(
                _coverage(sdf_segment(px, py, SHAFT_A, SHAFT_B, SHAFT_R) * scale),
                _coverage(sdf_triangle(px, py, HEAD_A, HEAD_B, HEAD_C) * scale),
            )
            if glyph_cov > 0.0:
                gcov = min(glyph_cov, bg_cov)
                r += (GLYPH[0] - r) * gcov
                g += (GLYPH[1] - g) * gcov
                b += (GLYPH[2] - b) * gcov

            row += bytes((
                int(round(r)),
                int(round(g)),
                int(round(b)),
                int(round(bg_cov * 255.0)),
            ))
        rows.append(row)
    return rows


def _coverage(sdf_px):
    """像素级有符号距离 -> 覆盖率（1px 线性过渡，即天然抗锯齿）。"""
    if sdf_px >= 0.5:
        return 0.0
    if sdf_px <= -0.5:
        return 1.0
    return 0.5 - sdf_px


# ---------- PNG 输出 ----------

def build_png(width, height, rows):
    raw = b"".join(b"\x00" + bytes(row) for row in rows)

    def chunk(tag, data):
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for size in SIZES:
        path = os.path.join(OUT_DIR, "icon{0}.png".format(size))
        with open(path, "wb") as handle:
            handle.write(build_png(size, size, render(size)))
        print("wrote {0} ({1}x{1})".format(os.path.relpath(path), size))


if __name__ == "__main__":
    main()
