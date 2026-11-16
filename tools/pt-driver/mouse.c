// Real mouse events. Usage: mouse click X Y | dclick X Y | rclick X Y | drag X1 Y1 X2 Y2 | scroll X Y DY
#include <ApplicationServices/ApplicationServices.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

static void post(CGEventType t, CGPoint p, CGMouseButton b, int clicks) {
    CGEventRef e = CGEventCreateMouseEvent(NULL, t, p, b);
    CGEventSetIntegerValueField(e, kCGMouseEventClickState, clicks);
    CGEventPost(kCGHIDEventTap, e);
    CFRelease(e);
}
static void click(CGPoint p, int n, int right) {
    CGEventType d = right ? kCGEventRightMouseDown : kCGEventLeftMouseDown;
    CGEventType u = right ? kCGEventRightMouseUp : kCGEventLeftMouseUp;
    CGMouseButton b = right ? kCGMouseButtonRight : kCGMouseButtonLeft;
    post(kCGEventMouseMoved, p, b, 0); usleep(80000);
    for (int i = 1; i <= n; i++) { post(d, p, b, i); usleep(30000); post(u, p, b, i); usleep(60000); }
}
int main(int argc, char **argv) {
    if (argc < 4) return 1;
    CGPoint p = CGPointMake(atof(argv[2]), atof(argv[3]));
    if (!strcmp(argv[1], "click")) click(p, 1, 0);
    else if (!strcmp(argv[1], "dclick")) click(p, 2, 0);
    else if (!strcmp(argv[1], "rclick")) click(p, 1, 1);
    else if (!strcmp(argv[1], "move")) post(kCGEventMouseMoved, p, kCGMouseButtonLeft, 0);
    else if (!strcmp(argv[1], "drag") && argc >= 6) {
        CGPoint q = CGPointMake(atof(argv[4]), atof(argv[5]));
        post(kCGEventMouseMoved, p, kCGMouseButtonLeft, 0); usleep(80000);
        post(kCGEventLeftMouseDown, p, kCGMouseButtonLeft, 1); usleep(100000);
        for (int i = 1; i <= 20; i++) {
            CGPoint m = CGPointMake(p.x + (q.x - p.x) * i / 20, p.y + (q.y - p.y) * i / 20);
            post(kCGEventLeftMouseDragged, m, kCGMouseButtonLeft, 1); usleep(20000);
        }
        post(kCGEventLeftMouseUp, q, kCGMouseButtonLeft, 1);
    } else if (!strcmp(argv[1], "scroll") && argc >= 5) {
        post(kCGEventMouseMoved, p, kCGMouseButtonLeft, 0); usleep(80000);
        CGEventRef e = CGEventCreateScrollWheelEvent(NULL, kCGScrollEventUnitLine, 1, atoi(argv[4]));
        CGEventPost(kCGHIDEventTap, e); CFRelease(e);
    }
    usleep(100000);
    return 0;
}
