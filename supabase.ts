const API =
  "https://script.google.com/macros/s/AKfycbx9WDHSr0NGe--C1KUIksijTScPMEmJyZfOjrygi4wURKMd-Xa4SFAD6eTCFnyPUMLU/exec";

export async function api(data: any) {

  const res = await fetch(API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(data)
  });

  return await res.json();
}
