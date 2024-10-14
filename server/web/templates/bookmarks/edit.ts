import { html } from "../../utils/html";
import { layout, LayoutProps } from "../layout";
import { field, FormData, FormValidationError } from "../../utils/forms";
import partialBookmarkForm from "../partials/bookmarkForm";
import bookmark from "../partials/bookmark";
import { BookmarkWithPermissions } from "@/services/bookmarks";

export interface Props extends LayoutProps {
  formData?: FormData;
  existingBookmark?: BookmarkWithPermissions;
  validationError?: FormValidationError;
}

export default ({
  formData,
  existingBookmark,
  validationError,
  ...locals
}: Props) => {
  const { csrfToken } = locals;
  const f = field({ formData, validationError });
  return layout({
    ...locals,
    title: "Edit Bookmark",
    content: html`
      <section class="bookmark-edit">
        ${partialBookmarkForm({
          csrfToken,
          formData,
          unfurlResult: existingBookmark?.meta?.unfurl,
          validationError,
          actionButtonTitle: "Save bookmark",
        })}
      </section>
    `,
  });
};
