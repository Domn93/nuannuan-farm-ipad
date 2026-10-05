import AppKit

// 原创矢量图标：奶油底色、田园小屋、樱花与阳光，无第三方素材或字体依赖。
let destination = CommandLine.arguments[1]
let size = 1024
let drawing = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8,
    bytesPerRow: size * 4, space: CGColorSpaceCreateDeviceRGB(),
    bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(cgContext: drawing, flipped: false)

func color(_ red: CGFloat, _ green: CGFloat, _ blue: CGFloat) -> NSColor {
    NSColor(calibratedRed: red, green: green, blue: blue, alpha: 1)
}
func ellipse(_ rect: NSRect, _ fill: NSColor) {
    fill.setFill()
    NSBezierPath(ovalIn: rect).fill()
}
func rounded(_ rect: NSRect, _ radius: CGFloat, _ fill: NSColor) {
    fill.setFill()
    NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius).fill()
}
func polygon(_ points: [NSPoint], _ fill: NSColor) {
    let path = NSBezierPath()
    path.move(to: points[0])
    for point in points.dropFirst() { path.line(to: point) }
    path.close()
    fill.setFill()
    path.fill()
}

color(0.98, 0.96, 0.88).setFill()
NSBezierPath(rect: NSRect(x: 0, y: 0, width: size, height: size)).fill()
ellipse(NSRect(x: 630, y: 670, width: 160, height: 160), color(0.96, 0.77, 0.38))
ellipse(NSRect(x: -180, y: -250, width: 1450, height: 780), color(0.72, 0.80, 0.55))
ellipse(NSRect(x: -150, y: -350, width: 1240, height: 700), color(0.52, 0.65, 0.40))
rounded(NSRect(x: 285, y: 297, width: 458, height: 348), 22, color(0.99, 0.94, 0.78))
rounded(NSRect(x: 655, y: 662, width: 52, height: 115), 8, color(0.65, 0.36, 0.27))
polygon([NSPoint(x: 235, y: 623), NSPoint(x: 514, y: 847), NSPoint(x: 795, y: 623)], color(0.73, 0.40, 0.31))
polygon([NSPoint(x: 276, y: 623), NSPoint(x: 514, y: 812), NSPoint(x: 752, y: 623)], color(0.85, 0.52, 0.37))
rounded(NSRect(x: 475, y: 297, width: 111, height: 198), 46, color(0.47, 0.57, 0.34))
ellipse(NSRect(x: 552, y: 383, width: 12, height: 12), color(0.96, 0.81, 0.43))
for x: CGFloat in [335, 635] {
    rounded(NSRect(x: x, y: 464, width: 62, height: 77), 9, color(0.53, 0.69, 0.65))
    rounded(NSRect(x: x + 27, y: 464, width: 8, height: 77), 0, color(0.99, 0.94, 0.78))
    rounded(NSRect(x: x, y: 497, width: 62, height: 8), 0, color(0.99, 0.94, 0.78))
}
rounded(NSRect(x: 162, y: 280, width: 26, height: 330), 10, color(0.52, 0.39, 0.27))
for (x, y, diameter): (CGFloat, CGFloat, CGFloat) in [(82, 565, 165), (150, 660, 152), (185, 580, 164)] {
    ellipse(NSRect(x: x, y: y, width: diameter, height: diameter), color(0.92, 0.67, 0.68))
}
for (x, y): (CGFloat, CGFloat) in [(168, 660), (230, 710), (128, 622), (222, 615), (820, 265), (760, 218)] {
    for index in 0..<5 {
        let angle = CGFloat(index) * .pi * 2 / 5
        ellipse(NSRect(x: x + cos(angle) * 13 - 10, y: y + sin(angle) * 13 - 10, width: 20, height: 20), color(0.99, 0.88, 0.77))
    }
    ellipse(NSRect(x: x - 6, y: y - 6, width: 12, height: 12), color(0.95, 0.72, 0.31))
}
for x: CGFloat in [95, 880] {
    rounded(NSRect(x: x, y: 213, width: 18, height: 132), 8, color(0.97, 0.91, 0.74))
}
rounded(NSRect(x: 85, y: 253, width: 147, height: 16), 5, color(0.97, 0.91, 0.74))
rounded(NSRect(x: 795, y: 253, width: 135, height: 16), 5, color(0.97, 0.91, 0.74))
NSGraphicsContext.restoreGraphicsState()
let bitmap = NSBitmapImageRep(cgImage: drawing.makeImage()!)
try bitmap.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: destination))
