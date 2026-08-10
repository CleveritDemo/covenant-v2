#import "ExceptionCatcher.h"

BOOL GravityCatchException(void (^block)(void), NSException **outException) {
  @try {
    block();
    return YES;
  } @catch (NSException *ex) {
    if (outException) {
      *outException = ex;
    }
    return NO;
  }
}
