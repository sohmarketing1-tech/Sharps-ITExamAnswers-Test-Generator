// Render each page of list.pdf (in the current folder) to p1.png, p2.png, ... for a quick look.
import Foundation; import PDFKit; import AppKit
let d = PDFDocument(url: URL(fileURLWithPath: "list.pdf"))!
print("pages", d.pageCount)
for i in 0..<d.pageCount { let p = d.page(at: i)!; let im = p.thumbnail(of: NSSize(width: 620, height: 800), for: .mediaBox)
 let r = NSBitmapImageRep(data: im.tiffRepresentation!)!; try! r.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: "p\(i+1).png")) }
