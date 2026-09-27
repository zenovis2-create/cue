#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <fwpmu.h>
#include <cstddef>
#include <iostream>

#define FIELD(type, field) std::cout << "offsetof." #type "." #field "=" << offsetof(type, field) << '\n'
#define SIZE(type) std::cout << "sizeof." #type "=" << sizeof(type) << '\n'

int main() {
  std::cout << "pointer.bits=" << sizeof(void*) * 8 << '\n';

  SIZE(FWPM_NET_EVENT_HEADER3);
  FIELD(FWPM_NET_EVENT_HEADER3, timeStamp);
  FIELD(FWPM_NET_EVENT_HEADER3, flags);
  FIELD(FWPM_NET_EVENT_HEADER3, ipVersion);
  FIELD(FWPM_NET_EVENT_HEADER3, ipProtocol);
  FIELD(FWPM_NET_EVENT_HEADER3, localAddrV4);
  FIELD(FWPM_NET_EVENT_HEADER3, remoteAddrV4);
  FIELD(FWPM_NET_EVENT_HEADER3, localPort);
  FIELD(FWPM_NET_EVENT_HEADER3, remotePort);
  FIELD(FWPM_NET_EVENT_HEADER3, appId);
  FIELD(FWPM_NET_EVENT_HEADER3, packageSid);

  SIZE(FWPM_NET_EVENT3);
  FIELD(FWPM_NET_EVENT3, header);
  FIELD(FWPM_NET_EVENT3, type);
  FIELD(FWPM_NET_EVENT3, capabilityDrop);

  SIZE(FWPM_NET_EVENT_CAPABILITY_DROP0);
  FIELD(FWPM_NET_EVENT_CAPABILITY_DROP0, networkCapabilityId);
  FIELD(FWPM_NET_EVENT_CAPABILITY_DROP0, filterId);
  FIELD(FWPM_NET_EVENT_CAPABILITY_DROP0, isLoopback);

  SIZE(FWPM_NET_EVENT_SUBSCRIPTION0);
  FIELD(FWPM_NET_EVENT_SUBSCRIPTION0, enumTemplate);
  FIELD(FWPM_NET_EVENT_SUBSCRIPTION0, flags);
  FIELD(FWPM_NET_EVENT_SUBSCRIPTION0, sessionKey);

  SIZE(FWP_VALUE0);
  FIELD(FWP_VALUE0, type);
  FIELD(FWP_VALUE0, uint32);
  std::cout << "sizeof.FWPM_NET_EVENT_CALLBACK2.pointer=" << sizeof(FWPM_NET_EVENT_CALLBACK2*) << '\n';
  return 0;
}
