const API_URL =
  "https://script.google.com/macros/s/AKfycbx3RpUhQHoVzj46vcPUeLwGEIyfxGd9dvR598lboqfzLW5bkGa4ye978qWQx664a7IG/exec";

export const supabase = {

  from: (sheet: string) => ({

    select: () => ({

      order: async () => {

        const res = await fetch(
          `${API_URL}?sheet=${sheet}`
        );

        const data = await res.json();

        return {
          data,
          error: null
        };

      },

      limit: async () => {

        const res = await fetch(
          `${API_URL}?sheet=${sheet}`
        );

        const data = await res.json();

        return {
          data,
          error: null
        };

      }

    }),

    insert: async (values: any[]) => {

      await fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({
          sheet,
          data: values
        })
      });

      return {
        data: null,
        error: null
      };

    }

  })

};

export const isCloudReady = true;
