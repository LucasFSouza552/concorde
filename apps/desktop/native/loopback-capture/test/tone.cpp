// Gerador de tom de teste (apenas para validar captura/isolacao).
// Renderiza um seno no dispositivo padrao por N segundos.
//
// Uso:  tone.exe --seconds <N> --freq <Hz> --amp <0..1> --id <rotulo>
// stderr: diagnostico. stdout: nada.

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#ifndef NOMINMAX
#define NOMINMAX
#endif
#ifndef _WIN32_WINNT
#define _WIN32_WINNT 0x0A00
#endif
#ifndef WINVER
#define WINVER 0x0A00
#endif

#include <windows.h>
#include <mmdeviceapi.h>
#include <audioclient.h>
#include <wrl.h>
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

using namespace Microsoft::WRL;

int main(int argc, char** argv) {
    double seconds = 2.0, freq = 440.0, amp = 0.05;
    const char* id = "tone";
    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "--seconds") == 0 && i + 1 < argc) seconds = atof(argv[++i]);
        else if (strcmp(argv[i], "--freq") == 0 && i + 1 < argc) freq = atof(argv[++i]);
        else if (strcmp(argv[i], "--amp") == 0 && i + 1 < argc) amp = atof(argv[++i]);
        else if (strcmp(argv[i], "--id") == 0 && i + 1 < argc) id = argv[++i];
    }
    setvbuf(stderr, nullptr, _IONBF, 0);

    HRESULT hr = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
    if (hr != S_OK && hr != S_FALSE && hr != RPC_E_CHANGED_MODE) return 3;

    ComPtr<IMMDeviceEnumerator> enumerator;
    hr = CoCreateInstance(__uuidof(MMDeviceEnumerator), nullptr, CLSCTX_ALL,
                          __uuidof(IMMDeviceEnumerator), &enumerator);
    if (FAILED(hr)) { fprintf(stderr, "[%s] enum hr=0x%08lX\n", id, (unsigned long)hr); return 3; }

    ComPtr<IMMDevice> device;
    hr = enumerator->GetDefaultAudioEndpoint(eRender, eConsole, &device);
    if (FAILED(hr)) { fprintf(stderr, "[%s] endpoint hr=0x%08lX\n", id, (unsigned long)hr); return 3; }

    ComPtr<IAudioClient> client;
    hr = device->Activate(__uuidof(IAudioClient), CLSCTX_ALL, nullptr, &client);
    if (FAILED(hr)) { fprintf(stderr, "[%s] activate hr=0x%08lX\n", id, (unsigned long)hr); return 3; }

    WAVEFORMATEX* fmt = nullptr;
    hr = client->GetMixFormat(&fmt);
    if (FAILED(hr)) { fprintf(stderr, "[%s] mixfmt hr=0x%08lX\n", id, (unsigned long)hr); return 3; }

    hr = client->Initialize(AUDCLNT_SHAREMODE_SHARED, 0, 1000000, 0, fmt, nullptr);
    if (FAILED(hr)) { fprintf(stderr, "[%s] init hr=0x%08lX\n", id, (unsigned long)hr); return 3; }

    UINT32 bufFrames = 0;
    client->GetBufferSize(&bufFrames);

    ComPtr<IAudioRenderClient> render;
    hr = client->GetService(__uuidof(IAudioRenderClient), &render);
    if (FAILED(hr)) { fprintf(stderr, "[%s] service hr=0x%08lX\n", id, (unsigned long)hr); return 3; }

    hr = client->Start();
    if (FAILED(hr)) { fprintf(stderr, "[%s] start hr=0x%08lX\n", id, (unsigned long)hr); return 3; }

    fprintf(stderr, "[%s] tocando pid=%lu freq=%.1f amp=%.3f sec=%.1f\n",
            id, (unsigned long)GetCurrentProcessId(), freq, amp, seconds);

    const double rate = (double)fmt->nSamplesPerSec;
    const UINT32 channels = fmt->nChannels;
    const WORD bits = fmt->wBitsPerSample;
    LONGLONG totalFrames = (LONGLONG)(rate * seconds);
    double phase = 0.0, dphase = 2.0 * 3.141592653589793 * freq / rate;

    while (totalFrames > 0) {
        UINT32 pad = 0;
        client->GetCurrentPadding(&pad);
        UINT32 avail = bufFrames - pad;
        if (avail == 0) { Sleep(5); continue; }
        if ((LONGLONG)avail > totalFrames) avail = (UINT32)totalFrames;

        BYTE* data = nullptr;
        hr = render->GetBuffer(avail, &data);
        if (FAILED(hr)) { Sleep(2); continue; }

        for (UINT32 f = 0; f < avail; f++) {
            double s = sin(phase) * amp;
            phase += dphase;
            if (phase > 2.0 * 3.141592653589793) phase -= 2.0 * 3.141592653589793;
            for (UINT32 c = 0; c < channels; c++) {
                if (bits == 32) ((float*)data)[(size_t)f * channels + c] = (float)s;
                else if (bits == 16) ((short*)data)[(size_t)f * channels + c] = (short)(s * 32767.0);
            }
        }
        render->ReleaseBuffer(avail, 0);
        totalFrames -= avail;
    }

    Sleep(300);
    client->Stop();
    fprintf(stderr, "[%s] fim\n", id);
    return 0;
}
