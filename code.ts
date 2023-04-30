figma.showUI(__html__, { width: 600, height: 560 });

figma.ui.onmessage = async (message) => {
  if (message.type === 'importColors') {
    const contents = message.contents;
    const palette = JSON.parse(contents);
    const importFormat = message.importFormat;

    if (importFormat === 'nested') {
      traverseNestedColors(palette);
    } else {
      for (const colorName in palette) {
        const colorValue = palette[colorName];

        addPaintStyle(colorName, colorValue);
      }
    }

    figma.ui.postMessage('importComplete');
  }

  if (message.type === 'exportColors') {
    const localPaintStyles = figma.getLocalPaintStyles();
    const exportedStyles: Record<string, unknown> = {};
    const exportFormat = message.exportFormat;

    localPaintStyles.forEach((style) => {
      const paint = style.paints[0];

      if (paint !== undefined && paint.type === 'SOLID') {
        const color = paint.color;
        const hexColor = `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;

        if (exportFormat === 'nested') {
          const parts = style.name.split('/');
          let currentLevel = exportedStyles;

          parts.forEach((part, index) => {
            if (index === parts.length - 1) {
              currentLevel[part] = hexColor;
            } else {
              if (!currentLevel.hasOwnProperty(part)) {
                currentLevel[part] = {};
              }

              const currentLevelPart = currentLevel[part];
              if (isRecord(currentLevelPart)) {
                currentLevel = currentLevelPart;
              }
            }
          });
        } else {
          exportedStyles[style.name] = hexColor;
        }
      }
    });

    figma.ui.postMessage({ type: 'exportedColors', exportedStyles });
  }

  if (message.type === 'deleteColors') {
    const localPaintStyles = figma.getLocalPaintStyles();
    localPaintStyles.forEach((style) => {
      style.remove();
    });

    figma.ui.postMessage('deleteComplete');
  }
};

function traverseNestedColors(obj: Record<string, unknown>, name = '') {
  for (const key in obj) {
    const value = obj[key];
    const newName = name === '' ? key : `${name}/${key}`;

    if (isRecord(value)) {
      traverseNestedColors(value, newName);
    } else {
      if (typeof value !== 'string') {
        throw new Error(
          `Unexpected value type for ${newName}: ${typeof value}`,
        );
      }

      addPaintStyle(newName, value);
    }
  }
}

function addPaintStyle(name: string, color: string) {
  const colorStyle = figma.createPaintStyle();
  colorStyle.name = name;
  colorStyle.paints = [
    {
      type: 'SOLID',
      color: {
        r: parseInt(color.substring(1, 3), 16) / 255,
        g: parseInt(color.substring(3, 5), 16) / 255,
        b: parseInt(color.substring(5, 7), 16) / 255,
      },
    },
  ];
}

function toHex(decimalValue: number) {
  return Math.round(decimalValue * 255)
    .toString(16)
    .padStart(2, '0');
}

function isRecord(obj: unknown): obj is Record<string, unknown> {
  return typeof obj === 'object' && obj !== null;
}
