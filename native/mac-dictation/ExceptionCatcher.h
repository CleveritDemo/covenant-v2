#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/// Ejecuta el bloque atrapando NSException de Objective-C (Swift do/catch no las captura).
/// Devuelve YES si terminó sin excepción.
BOOL GravityCatchException(void (^block)(void), NSException *_Nullable *_Nullable outException);

NS_ASSUME_NONNULL_END
