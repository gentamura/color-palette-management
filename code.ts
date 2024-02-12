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
    const colorFormat = message.colorFormat;

    localPaintStyles.forEach((style) => {
      const paint = style.paints[0];

      if (paint !== undefined && paint.type === 'SOLID') {
        const color = paint.color;
        const opacity = paint.opacity;
        let colorString = '';

        if (colorFormat === 'hex') {
          colorString = `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
        } else if (colorFormat === 'rgba') {
          colorString = toRGBA(color, opacity);
        } else {
          throw new Error(`Unexpected color format: ${colorFormat}`);
        }

        if (exportFormat === 'nested') {
          const parts = style.name.split('/');
          let currentLevel = exportedStyles;

          parts.forEach((part, index) => {
            if (index === parts.length - 1) {
              currentLevel[part] = colorString;
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
          exportedStyles[style.name] = colorString;
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

  let figmaColor, opacity;
  if (color.startsWith('#')) {
    // NOTE: If the color is in HEX format
    figmaColor = {
      r: parseInt(color.substring(1, 3), 16) / 255,
      g: parseInt(color.substring(3, 5), 16) / 255,
      b: parseInt(color.substring(5, 7), 16) / 255,
    };
    opacity = 1;
  } else if (color.startsWith('rgba')) {
    // NOTE: If the color is in RGBA format
    const { r, g, b, a } = rgbaToFigmaColor(color);
    figmaColor = { r, g, b };
    opacity = a;
  } else {
    throw new Error(`Unsupported color format: ${color}`);
  }

  colorStyle.paints = [
    {
      type: 'SOLID',
      color: figmaColor,
      opacity: opacity,
    },
  ];
}

// NOTE: Helper function to convert RGBA color code to Figma's color format
function rgbaToFigmaColor(rgba: string) {
  const rgbaValues = rgba
    .substring(5, rgba.length - 1)
    .split(',')
    .map((value) => parseFloat(value.trim()));

  return {
    r: rgbaValues[0] / 255,
    g: rgbaValues[1] / 255,
    b: rgbaValues[2] / 255,
    a: rgbaValues.length === 4 ? rgbaValues[3] : 1,
  };
}

function toRGBA(
  figmaColor: { r: number; g: number; b: number },
  _opacity?: number,
) {
  const r = Math.round(figmaColor.r * 255);
  const g = Math.round(figmaColor.g * 255);
  const b = Math.round(figmaColor.b * 255);
  const opacity = _opacity ? `, ${_opacity}` : '';

  return `rgba(${r}, ${g}, ${b}${opacity})`;
}

function toHex(decimalValue: number) {
  return Math.round(decimalValue * 255)
    .toString(16)
    .padStart(2, '0');
}

function isRecord(obj: unknown): obj is Record<string, unknown> {
  return typeof obj === 'object' && obj !== null;
}
